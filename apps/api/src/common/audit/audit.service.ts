import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { auditLogs } from '../../db/schema';

export interface RecordAuditParams {
  gymId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  adminActorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reasonCode?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
  device?: string | null;
}

/**
 * Canonical JSON serialization for cryptographic hashing (deterministic key order at all depths)
 */
function canonicalStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(canonicalStringify).join(',')}]`;
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`,
  );
  return `{${entries.join(',')}}`;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Appends an immutable audit log entry protected by a SHA-256 cryptographic hash chain
   * Spec Section 5.8: rowHash = sha256(prevHash || canonicalRow)
   */
  async log(params: RecordAuditParams) {
    try {
      // 1. Fetch latest row hash to form the chain
      const latestEntry = await this.db.query.auditLogs.findFirst({
        orderBy: [desc(auditLogs.id)],
      });

      const prevHash =
        latestEntry?.rowHash ??
        '0000000000000000000000000000000000000000000000000000000000000000';

      // 2. Canonical serialization for determinism (recursive sorted keys)
      const canonicalPayload = canonicalStringify({
        action: params.action,
        actorUserId: params.actorUserId ?? null,
        entityId: params.entityId ?? null,
        entityType: params.entityType,
        gymId: params.gymId ?? null,
        payload: params.payload ?? {},
      });

      const rowHash = createHash('sha256')
        .update(prevHash + canonicalPayload)
        .digest('hex');

      // 3. Insert append-only row
      const [entry] = await this.db
        .insert(auditLogs)
        .values({
          gymId: params.gymId ?? null,
          actorUserId: params.actorUserId ?? null,
          actorRole: params.actorRole ?? null,
          adminActorId: params.adminActorId ?? null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId ?? null,
          reasonCode: params.reasonCode ?? null,
          payload: params.payload ?? {},
          ip: params.ip ?? null,
          device: params.device ?? null,
          prevHash,
          rowHash,
        })
        .returning();

      return entry;
    } catch (err) {
      // Audit failures must never crash operations silently, but log loudly
      this.logger.error(`Failed to record audit log for action '${params.action}':`, err);
      return null;
    }
  }

  /**
   * Query audit history for a specific gym (strictly tenant-scoped)
   */
  async getGymAuditLogs(gymId: string, limit = 50) {
    return await this.db.query.auditLogs.findMany({
      where: eq(auditLogs.gymId, gymId),
      orderBy: [desc(auditLogs.id)],
      limit: Math.min(100, limit),
    });
  }

  /**
   * Verify cryptographic integrity of the hash chain
   */
  async verifyChainIntegrity(limit = 100): Promise<{ isValid: boolean; verifiedCount: number; errorAtId?: number; reason?: string }> {
    const rows = await this.db.query.auditLogs.findMany({
      orderBy: [desc(auditLogs.id)],
      limit,
    });

    if (rows.length === 0) {
      return { isValid: true, verifiedCount: 0 };
    }

    // Verify chronological order from oldest to newest
    const ascending = [...rows].reverse();

    for (let i = 0; i < ascending.length; i++) {
      const current = ascending[i];
      const previous = i > 0 ? ascending[i - 1] : null;

      const expectedPrevHash =
        previous?.rowHash ??
        current.prevHash ??
        '0000000000000000000000000000000000000000000000000000000000000000';

      // 1. Check prevHash link continuity across contiguous rows
      if (previous && current.prevHash !== previous.rowHash) {
        this.logger.warn(
          `Audit chain link broken at ID ${current.id}: row.prevHash does not match previous.rowHash`,
        );
        return {
          isValid: false,
          verifiedCount: i,
          errorAtId: current.id,
          reason: `Chain broken at ID ${current.id}: prevHash mismatch`,
        };
      }

      // 2. Canonical recalculation of the rowHash
      const canonicalPayload = canonicalStringify({
        action: current.action,
        actorUserId: current.actorUserId ?? null,
        entityId: current.entityId ?? null,
        entityType: current.entityType,
        gymId: current.gymId ?? null,
        payload: current.payload ?? {},
      });

      const recalculatedHash = createHash('sha256')
        .update(expectedPrevHash + canonicalPayload)
        .digest('hex');

      if (recalculatedHash !== current.rowHash) {
        this.logger.warn(
          `Audit hash tamper detected at ID ${current.id}: stored=${current.rowHash}, calculated=${recalculatedHash}`,
        );
        return {
          isValid: false,
          verifiedCount: i,
          errorAtId: current.id,
          reason: `Tamper detected at ID ${current.id}`,
        };
      }
    }

    return { isValid: true, verifiedCount: ascending.length };
  }
}
