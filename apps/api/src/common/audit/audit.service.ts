import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { DB, type Database, type TransactionClient, type DrizzleClient } from '../../db/db.tokens';
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
export function canonicalStringify(val: unknown): string {
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

export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes deterministic SHA-256 event hash over canonical audit fields
 */
export function computeEventHash(fields: Record<string, unknown>): string {
  const canonical = canonicalStringify(fields);
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Appends an immutable audit log entry protected by a SHA-256 cryptographic hash chain.
   * Acquired pg_advisory_xact_lock(hashtextextended(chain_key, 0)) guarantees race-free sequential hashing.
   * If a transaction handle `tx` is provided, the entry is written inside that transaction (fail-closed).
   */
  async log(params: RecordAuditParams, tx?: TransactionClient) {
    if (tx) {
      return await this.executeLog(params, tx);
    }
    return await this.db.transaction(async (innerTx) => {
      return await this.executeLog(params, innerTx);
    });
  }

  private async executeLog(params: RecordAuditParams, client: DrizzleClient) {
    const chainKey = params.gymId || 'platform';

    try {
      // 1. Transaction-level advisory lock per chain key to eliminate race conditions
      await client.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${chainKey}, 0));`,
      );

      // 2. Fetch latest row hash for this chain
      const latestEntry = await client.query.auditLogs.findFirst({
        where: eq(auditLogs.chainKey, chainKey),
        orderBy: [desc(auditLogs.id)],
      });

      const prevHash = latestEntry?.rowHash ?? GENESIS_PREV_HASH;

      // 3. Millisecond-truncated timestamp
      const now = new Date();
      const createdAtMs = new Date(Math.floor(now.getTime()));
      const createdAtIso = createdAtMs.toISOString();

      // 4. Canonical serialization across all defined fields
      const canonicalPayload = canonicalStringify({
        action: params.action,
        actorRole: params.actorRole ?? null,
        actorUserId: params.actorUserId ?? null,
        adminActorId: params.adminActorId ?? null,
        chainKey,
        createdAt: createdAtIso,
        device: params.device ?? null,
        entityId: params.entityId ?? null,
        entityType: params.entityType,
        gymId: params.gymId ?? null,
        hashVersion: 2,
        ip: params.ip ?? null,
        payload: params.payload ?? {},
        prevHash,
        reasonCode: params.reasonCode ?? null,
      });

      const rowHash = createHash('sha256')
        .update(canonicalPayload)
        .digest('hex');

      // 5. Insert append-only row
      const [entry] = await client
        .insert(auditLogs)
        .values({
          chainKey,
          hashVersion: 2,
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
          createdAt: createdAtMs,
        })
        .returning();

      return entry;
    } catch (err: any) {
      this.logger.error(`Failed to record audit log for action '${params.action}' in chain '${chainKey}':`, err);
      // Re-throw so caller transactions fail-closed
      throw err;
    }
  }

  /**
   * Query audit history for a specific gym (strictly tenant-scoped)
   */
  async getGymAuditLogs(gymId: string, limit = 50) {
    return await this.db.query.auditLogs.findMany({
      where: eq(auditLogs.chainKey, gymId),
      orderBy: [desc(auditLogs.id)],
      limit: Math.min(100, limit),
    });
  }

  /**
   * Query platform audit history
   */
  async getPlatformAuditLogs(limit = 100) {
    return await this.db.query.auditLogs.findMany({
      where: eq(auditLogs.chainKey, 'platform'),
      orderBy: [desc(auditLogs.id)],
      limit: Math.min(100, limit),
    });
  }

  /**
   * Verify cryptographic integrity of a specific chain (gym uuid or 'platform')
   */
  async verifyChainIntegrity(
    chainKey: string,
    limit = 100,
  ): Promise<{ isValid: boolean; verifiedCount: number; errorAtId?: number; reason?: string }> {
    const rows = await this.db.query.auditLogs.findMany({
      where: eq(auditLogs.chainKey, chainKey),
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

      const expectedPrevHash = previous?.rowHash ?? GENESIS_PREV_HASH;

      // 1. Check prevHash link continuity across contiguous rows in this chain
      if (current.prevHash !== expectedPrevHash) {
        this.logger.warn(
          `Audit chain link broken at ID ${current.id}: row.prevHash (${current.prevHash}) does not match previous.rowHash (${expectedPrevHash})`,
        );
        return {
          isValid: false,
          verifiedCount: i,
          errorAtId: current.id,
          reason: `Chain broken at ID ${current.id}: prevHash mismatch`,
        };
      }

      // 2. Canonical recalculation of the rowHash
      const createdAtDate = current.createdAt instanceof Date ? current.createdAt : new Date(current.createdAt);
      const createdAtIso = createdAtDate.toISOString();

      const canonicalPayload = canonicalStringify({
        action: current.action,
        actorRole: current.actorRole ?? null,
        actorUserId: current.actorUserId ?? null,
        adminActorId: current.adminActorId ?? null,
        chainKey: current.chainKey,
        createdAt: createdAtIso,
        device: current.device ?? null,
        entityId: current.entityId ?? null,
        entityType: current.entityType,
        gymId: current.gymId ?? null,
        hashVersion: current.hashVersion ?? 2,
        ip: current.ip ?? null,
        payload: (current.payload as Record<string, unknown>) ?? {},
        prevHash: current.prevHash ?? GENESIS_PREV_HASH,
        reasonCode: current.reasonCode ?? null,
      });

      const recalculatedHash = createHash('sha256')
        .update(canonicalPayload)
        .digest('hex');

      if (recalculatedHash !== current.rowHash) {
        this.logger.warn(
          `Audit hash tamper detected at ID ${current.id}: stored=${current.rowHash}, calculated=${recalculatedHash}`,
        );
        return {
          isValid: false,
          verifiedCount: i,
          errorAtId: current.id,
          reason: `Tamper detected at ID ${current.id}: stored=${current.rowHash}, calculated=${recalculatedHash}`,
        };
      }
    }

    return { isValid: true, verifiedCount: ascending.length };
  }
}
