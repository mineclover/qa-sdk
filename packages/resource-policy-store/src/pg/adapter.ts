// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * PgResourcePolicyRegistry — ResourcePolicyRegistry의 PostgreSQL 영속 구현.
 *
 * SqliteResourcePolicyRegistry와 동일 비즈니스 로직.
 * permission-engine의 순수 FSM 함수를 그대로 재사용 — dialect 차이는 driver type만.
 */

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  DuplicatePolicyError,
  PolicyNotFoundError,
  createUnregistered,
  delegateResourcePolicy,
  registerResourcePolicy,
  type ResourcePolicy,
  type ResourcePolicyCreateArgs,
  type ResourcePolicyDelegateArgs,
  type ResourcePolicyRegisterArgs,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
} from "permission-engine";

import { resourcePolicies } from "./schema.js";

type Row = typeof resourcePolicies.$inferSelect;

function toPolicy(row: Row): ResourcePolicy {
  return {
    resourceId: row.resourceId,
    resourceType: row.resourceType,
    state: row.state as ResourcePolicyState,
    ownerId: row.ownerId,
    cerbosPolicyRef: row.cerbosPolicyRef ?? undefined,
    graphRootId: row.graphRootId ?? undefined,
    registeredAt: row.registeredAt ?? undefined,
    delegatedAt: row.delegatedAt ?? undefined,
    updatedAt: row.updatedAt,
  };
}

function toRow(p: ResourcePolicy): typeof resourcePolicies.$inferInsert {
  return {
    resourceId: p.resourceId,
    resourceType: p.resourceType,
    state: p.state,
    ownerId: p.ownerId,
    cerbosPolicyRef: p.cerbosPolicyRef ?? null,
    graphRootId: p.graphRootId ?? null,
    registeredAt: p.registeredAt ?? null,
    delegatedAt: p.delegatedAt ?? null,
    updatedAt: p.updatedAt,
  };
}

export class PgResourcePolicyRegistry implements ResourcePolicyRegistry {
  constructor(private readonly db: PostgresJsDatabase) {}

  async resolve(resourceId: string): Promise<ResourcePolicy | null> {
    const rows = await this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.resourceId, resourceId))
      .limit(1);
    return rows.length === 0 ? null : toPolicy(rows[0]);
  }

  async create(args: ResourcePolicyCreateArgs): Promise<ResourcePolicy> {
    const existing = await this.resolve(args.resourceId);
    if (existing) throw new DuplicatePolicyError(args.resourceId);
    const policy = createUnregistered(args);
    await this.db.insert(resourcePolicies).values(toRow(policy));
    return policy;
  }

  async register(
    resourceId: string,
    args: ResourcePolicyRegisterArgs,
  ): Promise<ResourcePolicy> {
    const cur = await this.resolve(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = registerResourcePolicy(cur, args);
    await this.db.update(resourcePolicies)
      .set(toRow(next))
      .where(eq(resourcePolicies.resourceId, resourceId));
    return next;
  }

  async delegate(
    resourceId: string,
    args: ResourcePolicyDelegateArgs,
  ): Promise<ResourcePolicy> {
    const cur = await this.resolve(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = delegateResourcePolicy(cur, args);
    await this.db.update(resourcePolicies)
      .set(toRow(next))
      .where(eq(resourcePolicies.resourceId, resourceId));
    return next;
  }

  async remove(resourceId: string): Promise<void> {
    await this.db.delete(resourcePolicies)
      .where(eq(resourcePolicies.resourceId, resourceId));
  }

  async listByOwner(ownerId: string): Promise<ResourcePolicy[]> {
    const rows = await this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.ownerId, ownerId));
    return rows.map(toPolicy);
  }

  async listByState(state: ResourcePolicyState): Promise<ResourcePolicy[]> {
    const rows = await this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.state, state));
    return rows.map(toPolicy);
  }
}
