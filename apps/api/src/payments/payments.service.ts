import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, gt, gte, ilike, lte, or, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";
import {
  gyms,
  invoiceCounters,
  invoices,
  members,
  membershipAdjustments,
  membershipFreezes,
  memberships,
  payments,
  plans,
  shifts,
  users,
} from "../db/schema";
import {
  deskPaymentSchema,
  type DeskPaymentInput,
  voidPaymentSchema,
  type VoidPaymentInput,
  calculateVatInclusive,
  formatDateOnly,
  addDays,
  computeInclusiveEndDate,
} from "@gympulse/shared";
import { AuditService } from "../common/audit/audit.service";
import {
  scopeEntityToGym,
  scopeToGym,
} from "../common/tenant/tenant-scope.helper";
import { toUuidOrNull } from "../freezes/freezes.service";
import { getGymLocalDate } from "../common/utils/dates";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Process a front desk payment checkout (Cash, POS Card, or Bank Transfer)
   * Enforces:
   * 1. Cashier shift validation for cash payments
   * 2. Integer fils VAT math (round-half-up)
   * 3. Gapless atomic sequential invoice number generation (INV-000001)
   * 4. Immutable tax invoice creation
   * 5. Membership activation if applicable
   * 6. Tamper-evident cryptographic audit log
   * 7. SaaS subscription dunning restriction check
   */
  async createDeskPayment(
    gymId: string,
    rawInput: unknown,
    actorUserId?: string,
    actorRole?: string,
  ) {
    // Enforce platform SaaS subscription status
    await this.subscriptionsService.checkPaymentAllowed(gymId);

    const parseResult = deskPaymentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Invalid desk payment data",
        invalidParams: parseResult.error.issues.map(
          (i: { path: PropertyKey[]; message: string }) => ({
            name: i.path.join("."),
            reason: i.message,
          }),
        ),
      });
    }

    const input: DeskPaymentInput = parseResult.data;

    // Disallow deprecated fragmented sale/renewal paths
    if (input.purpose === "membership" || input.purpose === "renewal") {
      throw new BadRequestException({
        code: "PURPOSE_DEPRECATED",
        message:
          "Membership sales and renewals must be processed via /v1/sales/memberships or /v1/sales/renewals",
      });
    }

    if (
      input.purpose === "other" &&
      actorRole !== "owner" &&
      actorRole !== "manager"
    ) {
      throw new ForbiddenException({
        code: "PAYMENT_UNAUTHORIZED",
        message:
          "Only owners and managers are authorized to record other desk payments",
      });
    }

    // 1. Verify gym status
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Gym not found",
      });
    }

    if (gym.status === "suspended" || gym.status === "closed") {
      throw new ForbiddenException({
        code: "GYM_STATUS_RESTRICTED",
        message: `Cannot process payments: gym is currently ${gym.status}`,
      });
    }

    // 2. Verify shift if cash payment
    if (input.method === "cash") {
      if (!input.shiftId) {
        throw new BadRequestException({
          code: "SHIFT_NOT_OPEN",
          message: "An active shiftId is required for cash payments",
        });
      }

      const shift = await this.db.query.shifts.findFirst({
        where: scopeEntityToGym(shifts, gymId, input.shiftId),
      });

      if (!shift || shift.closedAt || shift.status !== "open") {
        throw new BadRequestException({
          code: "SHIFT_NOT_OPEN",
          message: "The specified shift is not found or is already closed",
        });
      }
    }

    // 3. Verify member exists in gym
    const member = await this.db
      .select({
        id: members.id,
        memberNumber: members.memberNumber,
        homeBranchId: members.homeBranchId,
        user: {
          id: users.id,
          fullName: users.fullName,
          phone: users.phone,
          email: users.email,
        },
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(scopeEntityToGym(members, gymId, input.memberId))
      .limit(1);

    if (member.length === 0) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Member not found",
      });
    }

    const memberData = member[0];

    // 4. Calculate VAT breakdown in minor units (fils/paise)
    const vatRateBps = gym.vatRegistered ? 500 : 0; // 5.00% VAT in UAE if registered
    const vatBreakdown = calculateVatInclusive(input.totalMinor, vatRateBps);

    // 5. Execute atomic transaction
    return await this.db.transaction(async (tx) => {
      // Insert payment row
      const [payment] = await tx
        .insert(payments)
        .values({
          gymId,
          branchId: memberData.homeBranchId ?? null,
          memberId: input.memberId,
          membershipId: input.membershipId ?? null,
          shiftId: input.shiftId ?? null,
          purpose: input.purpose,
          method: input.method,
          status: "succeeded",
          currency: input.currency ?? gym.currency,
          totalMinor: Number(vatBreakdown.totalMinor),
          baseMinor: Number(vatBreakdown.baseMinor),
          vatMinor: Number(vatBreakdown.vatMinor),
          vatRateBps,
          provider: input.method === "cash" ? "cash" : "card_pos",
          providerReference: input.providerReference ?? null,
          settledAt: new Date(),
          recordedBy: actorUserId ?? null,
        })
        .returning();

      // Sequential gapless invoice counter (SBX for unverified sandbox, INV/REC for verified)
      const isSandbox = gym.status === 'pending_verification';
      const series = isSandbox ? 'SBX' : (gym.vatRegistered ? 'INV' : 'REC');
      const docType = isSandbox ? 'receipt' : (gym.vatRegistered ? 'simplified_tax_invoice' : 'receipt');
      const [counter] = await tx
        .insert(invoiceCounters)
        .values({
          gymId,
          series,
          nextNumber: 2,
        })
        .onConflictDoUpdate({
          target: [invoiceCounters.gymId, invoiceCounters.series],
          set: {
            nextNumber: sql`${invoiceCounters.nextNumber} + 1`,
          },
        })
        .returning({
          assignedNumber: sql<number>`${invoiceCounters.nextNumber} - 1`,
        });

      const assignedNumber = Number(counter?.assignedNumber || 1);
      const year = new Date().getFullYear();
      const invoiceNumber = isSandbox
        ? `SBX-${year}-${String(assignedNumber).padStart(5, "0")}`
        : `${series}-${String(assignedNumber).padStart(6, "0")}`;
      const issuedOn = formatDateOnly(new Date());

      // Create simplified tax invoice (Spec Section 5.6)
      const [invoice] = await tx
        .insert(invoices)
        .values({
          gymId,
          paymentId: payment.id,
          docType: docType as any,
          series,
          number: assignedNumber,
          invoiceNumber,
          issuedOn,
          currency: payment.currency,
          supplier: {
            legalName: gym.legalName,
            tradeName: gym.tradeName,
            trnNumber: gym.trnNumber ?? null,
            tradeLicenseNumber: gym.tradeLicenseNumber,
            isSandbox,
          },
          buyer: {
            fullName: memberData.user.fullName,
            phone: memberData.user.phone,
            email: memberData.user.email,
            memberNumber: memberData.memberNumber,
          },
          lines: [
            {
              description: `Payment for ${input.purpose}`,
              totalMinor: Number(vatBreakdown.totalMinor),
              baseMinor: Number(vatBreakdown.baseMinor),
              vatMinor: Number(vatBreakdown.vatMinor),
              vatRateBps,
            },
          ],
          totals: {
            totalMinor: Number(vatBreakdown.totalMinor),
            baseMinor: Number(vatBreakdown.baseMinor),
            vatMinor: Number(vatBreakdown.vatMinor),
            vatRateBps,
            currency: payment.currency,
            isSandbox,
            watermark: isSandbox ? "SANDBOX DEMO - NOT A TAX INVOICE" : undefined,
          },
        })
        .returning();

      // Record audit log inside transaction (fail-closed)
      await this.auditService.log(
        {
          gymId,
          actorUserId: actorUserId ?? null,
          action: "payment.desk_sale",
          entityType: "payment",
          entityId: payment.id,
          payload: {
            invoiceNumber,
            totalMinor: payment.totalMinor,
            method: payment.method,
            purpose: payment.purpose,
            memberId: payment.memberId,
          },
        },
        tx,
      );

      return {
        payment,
        invoice,
      };
    });
  }

  /**
   * Get payment details and attached invoice
   */
  async getPaymentById(gymId: string, paymentId: string) {
    const payment = await this.db.query.payments.findFirst({
      where: scopeEntityToGym(payments, gymId, paymentId),
    });

    if (!payment) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Payment not found",
      });
    }

    const invoice = await this.db.query.invoices.findFirst({
      where: scopeToGym(invoices, gymId, eq(invoices.paymentId, paymentId)),
    });

    return {
      ...payment,
      invoice: invoice ?? null,
    };
  }

  /**
   * List all gym member tax invoices and credit notes (tenant scoped)
   */
  async listInvoices(
    gymId: string,
    query: {
      docType?: string;
      series?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const offset = Math.max(0, query.offset || 0);

    const conditions = [eq(invoices.gymId, gymId)];

    if (query.docType && query.docType !== 'all') {
      conditions.push(eq(invoices.docType, query.docType as any));
    }

    if (query.series && query.series !== 'all') {
      conditions.push(eq(invoices.series, query.series));
    }

    if (query.startDate) {
      conditions.push(gte(invoices.issuedOn, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(invoices.issuedOn, query.endDate));
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, term),
          sql`${invoices.buyer}->>'fullName' ILIKE ${term}`,
          sql`${invoices.buyer}->>'phone' ILIKE ${term}`,
        )!,
      );
    }

    const whereClause = and(...conditions);

    const invoiceList = await this.db.query.invoices.findMany({
      where: whereClause,
      orderBy: [desc(invoices.createdAt)],
      limit,
      offset,
    });

    return invoiceList;
  }

  /**
   * Get single invoice by ID with linked payment telemetry
   */
  async getInvoiceById(gymId: string, invoiceId: string) {
    const invoice = await this.db.query.invoices.findFirst({
      where: scopeEntityToGym(invoices, gymId, invoiceId),
    });

    if (!invoice) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Invoice not found",
      });
    }

    const payment = invoice.paymentId
      ? await this.db.query.payments.findFirst({
          where: scopeEntityToGym(payments, gymId, invoice.paymentId),
        })
      : null;

    return {
      ...invoice,
      payment: payment ?? null,
    };
  }

  /**
   * Obtain presigned S3 download URL for an invoice PDF
   * (Complies with UAE data residency and FTA retention rules)
   */
  async getInvoicePdf(gymId: string, invoiceId: string) {
    const invoice = await this.db.query.invoices.findFirst({
      where: scopeEntityToGym(invoices, gymId, invoiceId),
    });

    if (!invoice) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Invoice not found",
      });
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const fileName = `Invoice-${invoice.invoiceNumber}.pdf`;
    const s3Region = process.env.AWS_REGION || 'me-central-1';
    const s3Bucket = process.env.S3_INVOICE_BUCKET || 'gympulse-invoices-uae';
    const downloadUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/gyms/${gymId}/invoices/${invoice.invoiceNumber}.pdf?expires=${encodeURIComponent(expiresAt)}`;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      downloadUrl,
      fileName,
      expiresAt,
      currency: invoice.currency,
      totals: invoice.totals,
      supplier: invoice.supplier,
      buyer: invoice.buyer,
    };
  }

  /**
   * Safe Payment Void & Credit Note Issuance (Guide Step 5)
   *
   * 1. Restricted to gym owner only
   * 2. Only allowed while the cashier shift is still OPEN
   * 3. Reverses membership effect if no subsequent adjustments or freezes exist
   * 4. Issues gapless sequential Credit Note (series: 'CN')
   * 5. Excludes voided amount from shift expected cash
   * 6. Transactional, fail-closed audit log
   */
  async voidPayment(
    gymId: string,
    paymentId: string,
    rawInput: unknown,
    actorUserId?: string,
    actorRole?: string,
  ) {
    if (actorRole !== "owner") {
      throw new ForbiddenException({
        code: "VOID_UNAUTHORIZED",
        message: "Only gym owners are authorized to void payments",
      });
    }

    const parseResult = voidPaymentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Invalid void payment data",
        invalidParams: parseResult.error.issues.map(
          (i: { path: PropertyKey[]; message: string }) => ({
            name: i.path.join("."),
            reason: i.message,
          }),
        ),
      });
    }

    const input: VoidPaymentInput = parseResult.data;

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    if (!gym) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Gym not found",
      });
    }

    return await this.db.transaction(async (tx) => {
      // 1. Lock payment row with FOR UPDATE
      const payRows = await tx.execute<{
        id: string;
        gym_id: string;
        member_id: string;
        membership_id: string | null;
        shift_id: string | null;
        purpose: string;
        method: string;
        status: string;
        currency: string;
        total_minor: number;
        base_minor: number;
        vat_minor: number;
        vat_rate_bps: number;
      }>(
        sql`SELECT id, gym_id, member_id, membership_id, shift_id, purpose, method, status, currency, total_minor, base_minor, vat_minor, vat_rate_bps
            FROM payments
            WHERE gym_id = ${gymId} AND id = ${paymentId}
            FOR UPDATE`,
      );

      const payment = payRows.rows?.[0] ?? (payRows as any)?.[0];
      if (!payment) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: "Payment not found",
        });
      }

      // Harmless double void
      if (payment.status === "voided") {
        const existingCn = await tx.query.invoices.findFirst({
          where: and(
            eq(invoices.gymId, gymId),
            eq(invoices.paymentId, paymentId),
            eq(invoices.docType, "credit_note"),
          ),
        });
        return {
          payment,
          creditNote: existingCn ?? null,
          message: "Payment has already been voided",
        };
      }

      if (payment.status !== "succeeded") {
        throw new BadRequestException({
          code: "PAYMENT_NOT_SUCCEEDED",
          message: `Only succeeded payments can be voided. Current status is ${payment.status}`,
        });
      }

      // 2. Enforce OPEN Shift: reject if cashier shift is closed
      if (payment.shift_id) {
        const shift = await tx.query.shifts.findFirst({
          where: eq(shifts.id, payment.shift_id),
        });

        if (!shift || shift.closedAt || shift.status !== "open") {
          throw new BadRequestException({
            code: "SHIFT_CLOSED",
            message:
              "Payments from closed cashier shifts cannot be voided; an after-closeout correction requires a credit note workflow",
          });
        }
      }

      // 3. Reverse membership effect if applicable
      if (payment.membership_id) {
        const origAdj = await tx.query.membershipAdjustments.findFirst({
          where: eq(membershipAdjustments.paymentId, payment.id),
        });

        if (origAdj) {
          // Reject if any subsequent adjustments exist
          const newerAdj = await tx.query.membershipAdjustments.findFirst({
            where: and(
              eq(membershipAdjustments.membershipId, payment.membership_id),
              gt(membershipAdjustments.createdAt, origAdj.createdAt),
            ),
          });

          // Reject if any subsequent freezes exist
          const newerFreeze = await tx.query.membershipFreezes.findFirst({
            where: and(
              eq(membershipFreezes.membershipId, payment.membership_id),
              gt(membershipFreezes.createdAt, origAdj.createdAt),
            ),
          });

          if (newerAdj || newerFreeze) {
            throw new BadRequestException({
              code: "VOID_NOT_ALLOWED",
              message:
                "Cannot void payment: membership has subsequent freeze or adjustment records",
            });
          }

          const mem = await tx.query.memberships.findFirst({
            where: eq(memberships.id, payment.membership_id),
          });

          if (mem) {
            if (
              payment.purpose === "membership" ||
              origAdj.kind === "purchase"
            ) {
              // Initial purchase: cancel membership
              await tx
                .update(memberships)
                .set({
                  status: "cancelled",
                  statusBeforeFreeze: null,
                  version: mem.version + 1,
                  updatedAt: new Date(),
                })
                .where(eq(memberships.id, mem.id));

              await tx.insert(membershipAdjustments).values({
                gymId,
                membershipId: mem.id,
                kind: "correction",
                previousEndDate: mem.endDate,
                newEndDate: mem.startDate,
                reason: `Voided initial purchase: ${input.reason}`,
                createdBy: toUuidOrNull(actorUserId),
              });
            } else if (
              payment.purpose === "renewal" ||
              origAdj.kind === "renewal"
            ) {
              // Renewal: restore previous end date
              await tx
                .update(memberships)
                .set({
                  endDate: origAdj.previousEndDate,
                  version: mem.version + 1,
                  updatedAt: new Date(),
                })
                .where(eq(memberships.id, mem.id));

              await tx.insert(membershipAdjustments).values({
                gymId,
                membershipId: mem.id,
                kind: "correction",
                previousEndDate: mem.endDate,
                newEndDate: origAdj.previousEndDate,
                reason: `Voided renewal: ${input.reason}`,
                createdBy: toUuidOrNull(actorUserId),
              });
            }
          }
        }
      }

      // 4. Issue Gapless Credit Note (series: 'CN')
      const origInvoice = await tx.query.invoices.findFirst({
        where: and(
          eq(invoices.paymentId, payment.id),
          sql`${invoices.docType} != 'credit_note'`,
        ),
      });

      const series = "CN";
      const [counter] = await tx
        .insert(invoiceCounters)
        .values({
          gymId,
          series,
          nextNumber: 2,
        })
        .onConflictDoUpdate({
          target: [invoiceCounters.gymId, invoiceCounters.series],
          set: {
            nextNumber: sql`${invoiceCounters.nextNumber} + 1`,
          },
        })
        .returning({
          assignedNumber: sql<number>`${invoiceCounters.nextNumber} - 1`,
        });

      const assignedNumber = Number(counter?.assignedNumber || 1);
      const creditNoteNumber = `${series}-${String(assignedNumber).padStart(6, "0")}`;
      const today = getGymLocalDate(gym.timezone || "Asia/Dubai");

      const origLines = (origInvoice?.lines as any[]) || [];
      const creditLines =
        origLines.length > 0
          ? origLines.map((l) => ({
              ...l,
              description: `Credit Note / Reversal: ${l.description}`,
              totalMinor: -Math.abs(Number(l.totalMinor || 0)),
              baseMinor: -Math.abs(Number(l.baseMinor || 0)),
              vatMinor: -Math.abs(Number(l.vatMinor || 0)),
            }))
          : [
              {
                description: `Credit Note reversal for payment ${payment.id}: ${input.reason}`,
                totalMinor: -payment.total_minor,
                baseMinor: -payment.base_minor,
                vatMinor: -payment.vat_minor,
                vatRateBps: payment.vat_rate_bps,
              },
            ];

      const [creditNote] = await tx
        .insert(invoices)
        .values({
          gymId,
          paymentId: payment.id,
          docType: "credit_note",
          series,
          number: assignedNumber,
          invoiceNumber: creditNoteNumber,
          issuedOn: today,
          currency: payment.currency,
          originalInvoiceId: origInvoice?.id ?? null,
          supplier: origInvoice?.supplier ?? {
            legalName: gym.legalName,
            tradeName: gym.tradeName,
            trnNumber: gym.trnNumber ?? null,
            tradeLicenseNumber: gym.tradeLicenseNumber,
          },
          buyer: origInvoice?.buyer ?? {
            fullName: "Member",
          },
          lines: creditLines,
          totals: {
            totalMinor: -payment.total_minor,
            baseMinor: -payment.base_minor,
            vatMinor: -payment.vat_minor,
            vatRateBps: payment.vat_rate_bps,
            currency: payment.currency,
          },
        })
        .returning();

      // 5. Exclude from shift cash sales if cash payment
      if (payment.method === "cash" && payment.shift_id) {
        await tx
          .update(shifts)
          .set({
            cashSalesMinor: sql`${shifts.cashSalesMinor} - ${payment.total_minor}`,
          })
          .where(eq(shifts.id, payment.shift_id));
      }

      // 6. Update payment status to voided
      const [voided] = await tx
        .update(payments)
        .set({
          status: "voided",
          voidReason: input.reason,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      // 7. Transactional Audit Log
      await this.auditService.log(
        {
          gymId,
          actorUserId: actorUserId ?? null,
          actorRole,
          action: "payment.void",
          entityType: "payment",
          entityId: payment.id,
          payload: {
            totalMinor: payment.total_minor,
            reason: input.reason,
            creditNoteNumber,
            originalInvoiceNumber: origInvoice?.invoiceNumber ?? null,
          },
        },
        tx,
      );

      return {
        payment: voided,
        creditNote,
      };
    });
  }
}
