import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { and, eq, SQL } from 'drizzle-orm';
import { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/**
 * Tenant Scoping Utilities
 * Enforces multi-tenant isolation at the query construction layer.
 */

/**
 * Returns a Drizzle SQL condition enforcing that the table's gymId matches the tenant's gymId.
 */
export function scopeToGym<T extends { gymId: PgColumn }>(
  table: T,
  gymId: string,
  extraCondition?: SQL | undefined,
): SQL {
  const gymCondition = eq(table.gymId, gymId);
  return extraCondition ? and(gymCondition, extraCondition)! : gymCondition;
}

/**
 * Returns a composite Drizzle SQL condition binding BOTH gymId and entity ID.
 * Rule: A tenant-scoped resource MUST NEVER be fetched, updated, or deleted by ID alone.
 */
export function scopeEntityToGym<T extends { gymId: PgColumn; id: PgColumn }>(
  table: T,
  gymId: string,
  entityId: string,
  extraCondition?: SQL | undefined,
): SQL {
  const compositeCondition = and(eq(table.gymId, gymId), eq(table.id, entityId))!;
  return extraCondition ? and(compositeCondition, extraCondition)! : compositeCondition;
}

/**
 * Validates that an object belongs to the tenant.
 * Throws TENANT_MISMATCH if the resource belongs to another gym.
 */
export function assertTenantOwnership(
  resource: { gymId?: string | null } | null | undefined,
  expectedGymId: string,
  resourceName = 'Resource',
): void {
  if (!resource) {
    throw new NotFoundException({
      code: 'RESOURCE_NOT_FOUND',
      message: `${resourceName} not found`,
    });
  }

  if (resource.gymId !== expectedGymId) {
    throw new ForbiddenException({
      code: 'TENANT_MISMATCH',
      message: `Access denied: this ${resourceName.toLowerCase()} belongs to another gym`,
    });
  }
}
