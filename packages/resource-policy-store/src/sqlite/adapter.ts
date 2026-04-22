// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * SqliteResourcePolicyRegistry — permission-engine의 ResourcePolicyRegistry
 * 인터페이스를 SQLite + Drizzle로 영속 구현.
 *
 * Plan 05a에서 sqlite/ 디렉토리로 이동 + 클래스 rename.
 * 비즈니스 로직 변경 없음 — 순수 refactor.
 *
 * FSM 규약(역전이 금지, canTransition) 자체는 순수 함수(permission-engine/state)에서
 * 재사용하고, 본 어댑터는 I/O만 담당한다.
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";

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
    state: row.state,
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

export class SqliteResourcePolicyRegistry implements ResourcePolicyRegistry {
  constructor(private readonly db: BetterSQLite3Database) {}

  async resolve(resourceId: string): Promise<ResourcePolicy | null> {
    const rows = this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.resourceId, resourceId))
      .limit(1).all();
    return rows.length === 0 ? null : toPolicy(rows[0]);
  }

  async create(args: ResourcePolicyCreateArgs): Promise<ResourcePolicy> {
    const existing = await this.resolve(args.resourceId);
    if (existing) throw new DuplicatePolicyError(args.resourceId);
    const policy = createUnregistered(args);
    this.db.insert(resourcePolicies).values(toRow(policy)).run();
    return policy;
  }

  async register(
    resourceId: string,
    args: ResourcePolicyRegisterArgs,
  ): Promise<ResourcePolicy> {
    const cur = await this.resolve(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = registerResourcePolicy(cur, args);
    this.db.update(resourcePolicies)
      .set(toRow(next))
      .where(eq(resourcePolicies.resourceId, resourceId))
      .run();
    return next;
  }

  async delegate(
    resourceId: string,
    args: ResourcePolicyDelegateArgs,
  ): Promise<ResourcePolicy> {
    const cur = await this.resolve(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = delegateResourcePolicy(cur, args);
    this.db.update(resourcePolicies)
      .set(toRow(next))
      .where(eq(resourcePolicies.resourceId, resourceId))
      .run();
    return next;
  }

  async remove(resourceId: string): Promise<void> {
    this.db.delete(resourcePolicies)
      .where(eq(resourcePolicies.resourceId, resourceId))
      .run();
  }

  async listByOwner(ownerId: string): Promise<ResourcePolicy[]> {
    return this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.ownerId, ownerId))
      .all()
      .map(toPolicy);
  }

  async listByState(state: ResourcePolicyState): Promise<ResourcePolicy[]> {
    return this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.state, state))
      .all()
      .map(toPolicy);
  }
}
