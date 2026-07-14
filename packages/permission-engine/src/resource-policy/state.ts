// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * ResourcePolicy state machine — 리소스 인스턴스 권한 lifecycle FSM.
 *
 * 3 상태:
 *   UNREGISTERED (default) — 소유자만 접근
 *   REGISTERED             — Cerbos policy 판정
 *   DELEGATED              — ACL 그래프 탐색
 *
 * 역전이 금지:
 *   REGISTERED → UNREGISTERED (금지)
 *   DELEGATED  → REGISTERED   (금지)
 *
 * 접근 범위 축소는 상태 역전이가 아니라 현 상태의 policy 변경으로 표현한다.
 * 근거: `docs/specs/authorization-ontology/authorization-ontology-resource-lifecycle.spec.md`
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ResourcePolicyState = 'UNREGISTERED' | 'REGISTERED' | 'DELEGATED';

export interface ResourcePolicy {
  resourceId: string;
  resourceType: string;
  state: ResourcePolicyState;
  ownerId: string;
  /** REGISTERED | DELEGATED 상태에서만 유효. */
  cerbosPolicyRef?: string;
  /** DELEGATED 상태에서만 유효. */
  graphRootId?: string;
  /** UNREGISTERED → REGISTERED 전이 시각. */
  registeredAt?: string;
  /** REGISTERED → DELEGATED 전이 시각. */
  delegatedAt?: string;
  updatedAt: string;
}

// ── Transitions ──────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ResourcePolicyState, readonly ResourcePolicyState[]> = {
  UNREGISTERED: ['REGISTERED'],
  REGISTERED: ['DELEGATED'],
  DELEGATED: [],
};

export function canTransition(from: ResourcePolicyState, to: ResourcePolicyState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: ResourcePolicyState,
    public readonly to: ResourcePolicyState,
  ) {
    super(`Illegal resource policy transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

// ── Transition args ──────────────────────────────────────────────────────────

export interface RegisterArgs {
  cerbosPolicyRef: string;
  /** 호출 시각. 주입 없으면 Date.now() 사용. */
  now?: string;
}

export interface DelegateArgs {
  graphRootId: string;
  /** cerbos_policy_ref는 REGISTERED에서 이미 설정돼 있어야 하고 DELEGATED로 전이 시 유지된다. */
  now?: string;
}

// ── Transition fns ───────────────────────────────────────────────────────────

/**
 * UNREGISTERED → REGISTERED.
 * cerbosPolicyRef와 registeredAt이 설정된다.
 */
export function register(policy: ResourcePolicy, args: RegisterArgs): ResourcePolicy {
  if (!canTransition(policy.state, 'REGISTERED')) {
    throw new InvalidTransitionError(policy.state, 'REGISTERED');
  }
  const now = args.now ?? new Date().toISOString();
  return {
    ...policy,
    state: 'REGISTERED',
    cerbosPolicyRef: args.cerbosPolicyRef,
    registeredAt: now,
    updatedAt: now,
  };
}

/**
 * REGISTERED → DELEGATED.
 * graphRootId와 delegatedAt이 설정된다. cerbosPolicyRef는 유지.
 */
export function delegate(policy: ResourcePolicy, args: DelegateArgs): ResourcePolicy {
  if (!canTransition(policy.state, 'DELEGATED')) {
    throw new InvalidTransitionError(policy.state, 'DELEGATED');
  }
  if (!policy.cerbosPolicyRef) {
    throw new InvalidTransitionError(policy.state, 'DELEGATED');
  }
  const now = args.now ?? new Date().toISOString();
  return {
    ...policy,
    state: 'DELEGATED',
    graphRootId: args.graphRootId,
    delegatedAt: now,
    updatedAt: now,
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export interface CreateArgs {
  resourceId: string;
  resourceType: string;
  ownerId: string;
  now?: string;
}

/**
 * 새 리소스 생성 시 초기 policy.
 * 리소스 생성과 같은 트랜잭션 내에서 호출되어야 race를 방지한다.
 */
export function createUnregistered(args: CreateArgs): ResourcePolicy {
  const now = args.now ?? new Date().toISOString();
  return {
    resourceId: args.resourceId,
    resourceType: args.resourceType,
    state: 'UNREGISTERED',
    ownerId: args.ownerId,
    updatedAt: now,
  };
}

// ── Access judgement helpers ─────────────────────────────────────────────────

/**
 * UNREGISTERED 상태에서 `actorUserId`가 접근 가능한지 판정.
 * REGISTERED/DELEGATED는 Cerbos/ACL에 위임되므로 본 함수 대상 아님.
 */
export function canAccessUnregistered(policy: ResourcePolicy, actorUserId: string): boolean {
  if (policy.state !== 'UNREGISTERED') {
    throw new Error(
      `canAccessUnregistered called on ${policy.state} policy for resource ${policy.resourceId}`,
    );
  }
  return policy.ownerId === actorUserId;
}
