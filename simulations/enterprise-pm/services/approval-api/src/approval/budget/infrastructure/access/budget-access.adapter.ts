// @def.boundary sim-approval-api
// @def.doc authorization-ontology-resource-lifecycle

import { randomBytes } from 'node:crypto';
import type {
  AccessChecker,
  AccessContext,
  AccessResult,
  ApiCall,
  ResourcePolicyRegistry,
} from 'permission-engine';

import {
  BudgetAccessQueryPort,
  BudgetPolicyLifecyclePort,
  type BudgetAccessQueryInput,
  type BudgetAccessQueryResult,
  type BudgetApiId,
} from '../../application/ports/access-check.port.js';

/**
 * BUDGET_API_COORDS — DisjointUnionIndex encode() 용 1-based 좌표.
 *
 * approval-api 의 buildDefaultUnion labels (budget.create/read/submit/start-review/
 * approve/reject) 순서와 1:1 매칭. WeightedIndex.encode 는 1-based 이므로 6 action
 * 은 [1..6].
 */
const BUDGET_API_COORDS: Record<BudgetApiId, number[]> = {
  'budget.create': [1],
  'budget.read': [2],
  'budget.submit': [3],
  'budget.start-review': [4],
  'budget.approve': [5],
  'budget.reject': [6],
};

function newSpanId(): string {
  return randomBytes(8).toString('hex');
}

function newTraceId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * BudgetAccessQueryPort 어댑터 — 슬라이스 외부 (auth bounded context) 의
 * AccessChecker 를 호출해 결과를 BudgetAccessQueryResult 로 매핑.
 *
 * NEW SLICE 컨벤션: 슬라이스는 AccessChecker / ApiCall 등 auth 내부 타입을
 * 직접 참조하지 않고 BudgetAccessQueryPort 추상에만 의존한다. 본 어댑터가 변환을
 * 흡수한다 (legacy budget-access.service.ts 와 의미 동일).
 */
export class BudgetAccessAdapter extends BudgetAccessQueryPort {
  constructor(private readonly checker: AccessChecker) {
    super();
  }

  async check(input: BudgetAccessQueryInput): Promise<BudgetAccessQueryResult> {
    const hasResource =
      input.requestId !== null &&
      input.resourceOwnerId !== null &&
      input.resourceOwnerId !== undefined;

    const call: ApiCall = hasResource
      ? {
          kind: 'resource',
          apiId: input.apiId,
          coords: BUDGET_API_COORDS[input.apiId],
          targetId: input.requestId!,
          resource: {
            id: input.requestId!,
            ownerId: input.resourceOwnerId!,
            attributes: {
              actorDepartmentId: input.user.departmentId ?? null,
              actorPrimaryRoleId: input.user.primaryRoleId ?? null,
              actorRoleIds: input.user.roleIds ?? [],
              actorRoleNames: input.user.roleNames ?? [],
              actorRoleAssignments: input.user.roleAssignments ?? [],
              projectDepartmentId: input.projectDepartmentId,
              approverDepartmentId: input.approverDepartmentId ?? null,
              apiId: input.apiId,
            },
          },
        }
      : {
          kind: 'transaction',
          apiId: input.apiId,
          coords: BUDGET_API_COORDS[input.apiId],
          targetId: input.requestId ?? input.apiId,
        };

    const ctx: AccessContext = {
      userId: input.user.userId,
      bitmap: {
        prefix: 'sim.bitmap',
        v: input.user.bitmapVersion,
        mask: input.user.bitmapMask,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        issuer: 'sim-approval-api',
        signature: '',
      },
      parentSpanId: null,
      traceId: newTraceId(),
      newSpanId,
    };

    const result: AccessResult = await this.checker.check(ctx, call);

    return {
      allow: result.allowed,
      rootSpanId: result.executionSpanId,
      denyReason: result.denyReason,
    };
  }
}

/**
 * BudgetPolicyLifecyclePort 어댑터 — Pass 2 lifecycle (UNREGISTERED → REGISTERED).
 *
 * legacy BudgetService.create 의 policy 생성/등록 로직과 동일.
 * fail 시 throw 하면 use-case 가 logger.warn 으로 잡고 swallow 한다 (fail-open).
 */
export class BudgetPolicyLifecycleAdapter extends BudgetPolicyLifecyclePort {
  constructor(private readonly registry: ResourcePolicyRegistry) {
    super();
  }

  async onCreated(input: {
    readonly requestId: string;
    readonly requesterId: string;
  }): Promise<void> {
    await this.registry.create({
      resourceId: input.requestId,
      resourceType: 'budget_request',
      ownerId: input.requesterId,
    });
    // Plan 13 시나리오 3/5: 다른 user 가 승인자로 참여할 수 있도록 즉시 REGISTERED 로
    // 전이 — SimInstanceEvaluator.evaluateRegistered 는 policyRef 가 비어있지 않으면
    // allow 를 시도한다.
    await this.registry.register(input.requestId, {
      cerbosPolicyRef: `budget-request-${input.requestId}`,
    });
  }
}
