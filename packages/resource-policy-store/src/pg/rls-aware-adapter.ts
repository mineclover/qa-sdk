// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { Sql } from 'postgres';

import {
  createRlsTxRunner,
  getCurrentRlsContext,
  type RlsTxRunner,
  type RlsSessionContext,
  type RlsTxSql,
} from 'db-bootstrap';

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
} from 'permission-engine';

interface RawRow {
  resource_id: string;
  resource_type: string;
  state: string;
  owner_id: string;
  cerbos_policy_ref: string | null;
  graph_root_id: string | null;
  registered_at: string | null;
  delegated_at: string | null;
  updated_at: string;
}

function toPolicy(row: RawRow): ResourcePolicy {
  return {
    resourceId: row.resource_id,
    resourceType: row.resource_type,
    state: row.state as ResourcePolicyState,
    ownerId: row.owner_id,
    cerbosPolicyRef: row.cerbos_policy_ref ?? undefined,
    graphRootId: row.graph_root_id ?? undefined,
    registeredAt: row.registered_at ?? undefined,
    delegatedAt: row.delegated_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

/**
 * PgResourcePolicyRegistry 의 RLS-aware 래퍼.
 *
 * 모든 호출을 RlsTxRunner 트랜잭션 안에서 실행 — SET LOCAL 로 RlsSessionContext (혹은 explicit ctx) 주입.
 * interceptor 없는 경로(CLI 등) 는 overrideContext 인자로 명시적 지정.
 *
 * 구현 노트: drizzle({ client }) 는 sql.options.parsers 에 의존하는데 tx 는
 * options 가 없는 TransactionSql 이라 호출 불가. 대신 raw `tx`SQL`` 를 사용해
 * 동일 비즈니스 로직(permission-engine 순수 FSM) 을 재현.
 */
export class RlsAwarePgResourcePolicyRegistry implements ResourcePolicyRegistry {
  private readonly runner: RlsTxRunner;

  constructor(
    private readonly sql: Sql,
    private readonly overrideContext?: RlsSessionContext,
  ) {
    this.runner = createRlsTxRunner(sql);
  }

  private ctx(): RlsSessionContext {
    return this.overrideContext ?? getCurrentRlsContext();
  }

  private async resolveRaw(tx: RlsTxSql, resourceId: string): Promise<ResourcePolicy | null> {
    const rows = await tx<RawRow[]>`
      SELECT resource_id, resource_type, state, owner_id, cerbos_policy_ref,
             graph_root_id, registered_at, delegated_at, updated_at
        FROM auth.resource_policies
       WHERE resource_id = ${resourceId}
       LIMIT 1`;
    return rows.length === 0 ? null : toPolicy(rows[0]);
  }

  async resolve(resourceId: string): Promise<ResourcePolicy | null> {
    return this.runner(this.ctx(), async (tx) => this.resolveRaw(tx, resourceId));
  }

  async create(args: ResourcePolicyCreateArgs): Promise<ResourcePolicy> {
    return this.runner(this.ctx(), async (tx) => {
      const existing = await this.resolveRaw(tx, args.resourceId);
      if (existing) throw new DuplicatePolicyError(args.resourceId);
      const policy = createUnregistered(args);
      await tx`
        INSERT INTO auth.resource_policies
          (resource_id, resource_type, state, owner_id, cerbos_policy_ref,
           graph_root_id, registered_at, delegated_at, updated_at)
        VALUES (
          ${policy.resourceId}, ${policy.resourceType}, ${policy.state}, ${policy.ownerId},
          ${policy.cerbosPolicyRef ?? null}, ${policy.graphRootId ?? null},
          ${policy.registeredAt ?? null}, ${policy.delegatedAt ?? null}, ${policy.updatedAt}
        )`;
      return policy;
    });
  }

  async register(resourceId: string, args: ResourcePolicyRegisterArgs): Promise<ResourcePolicy> {
    return this.runner(this.ctx(), async (tx) => {
      const cur = await this.resolveRaw(tx, resourceId);
      if (!cur) throw new PolicyNotFoundError(resourceId);
      const next = registerResourcePolicy(cur, args);
      await tx`
        UPDATE auth.resource_policies SET
          resource_type = ${next.resourceType},
          state = ${next.state},
          owner_id = ${next.ownerId},
          cerbos_policy_ref = ${next.cerbosPolicyRef ?? null},
          graph_root_id = ${next.graphRootId ?? null},
          registered_at = ${next.registeredAt ?? null},
          delegated_at = ${next.delegatedAt ?? null},
          updated_at = ${next.updatedAt}
        WHERE resource_id = ${resourceId}`;
      return next;
    });
  }

  async delegate(resourceId: string, args: ResourcePolicyDelegateArgs): Promise<ResourcePolicy> {
    return this.runner(this.ctx(), async (tx) => {
      const cur = await this.resolveRaw(tx, resourceId);
      if (!cur) throw new PolicyNotFoundError(resourceId);
      const next = delegateResourcePolicy(cur, args);
      await tx`
        UPDATE auth.resource_policies SET
          resource_type = ${next.resourceType},
          state = ${next.state},
          owner_id = ${next.ownerId},
          cerbos_policy_ref = ${next.cerbosPolicyRef ?? null},
          graph_root_id = ${next.graphRootId ?? null},
          registered_at = ${next.registeredAt ?? null},
          delegated_at = ${next.delegatedAt ?? null},
          updated_at = ${next.updatedAt}
        WHERE resource_id = ${resourceId}`;
      return next;
    });
  }

  async remove(resourceId: string): Promise<void> {
    await this.runner(this.ctx(), async (tx) => {
      await tx`DELETE FROM auth.resource_policies WHERE resource_id = ${resourceId}`;
    });
  }

  async listByOwner(ownerId: string): Promise<ResourcePolicy[]> {
    return this.runner(this.ctx(), async (tx) => {
      const rows = await tx<RawRow[]>`
        SELECT resource_id, resource_type, state, owner_id, cerbos_policy_ref,
               graph_root_id, registered_at, delegated_at, updated_at
          FROM auth.resource_policies
         WHERE owner_id = ${ownerId}`;
      return rows.map(toPolicy);
    });
  }

  async listByState(state: ResourcePolicyState): Promise<ResourcePolicy[]> {
    return this.runner(this.ctx(), async (tx) => {
      const rows = await tx<RawRow[]>`
        SELECT resource_id, resource_type, state, owner_id, cerbos_policy_ref,
               graph_root_id, registered_at, delegated_at, updated_at
          FROM auth.resource_policies
         WHERE state = ${state}`;
      return rows.map(toPolicy);
    });
  }
}
