// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

/**
 * 슬라이스가 자기 도메인 외부의 access(인증/인가) bounded context 에 의존할 때
 * 사용하는 query port. infrastructure 어댑터가 실제 AccessChecker / 정책 레지스트리를
 * 호출해 결과만 반환한다.
 *
 * - budget 슬라이스는 access bounded context 의 내부 타입 (AccessChecker, ApiCall …)
 *   을 직접 import 하지 않는다 (domain-slice-kit 컨벤션 — cross-domain 은 query port).
 */
export type BudgetApiId =
  | "budget.create"
  | "budget.read"
  | "budget.submit"
  | "budget.start-review"
  | "budget.approve"
  | "budget.reject";

export interface BudgetUserContext {
  readonly userId: string;
  readonly bitmapMask: Uint8Array;
  readonly bitmapVersion: string;
  readonly departmentId?: string | null;
  readonly primaryRoleId?: string | null;
  readonly roleIds?: readonly string[];
  readonly roleNames?: readonly string[];
  readonly roleAssignments?: readonly unknown[];
}

export interface BudgetAccessQueryInput {
  readonly apiId: BudgetApiId;
  readonly user: BudgetUserContext;
  readonly requestId: string | null;
  readonly projectDepartmentId: string | null;
  readonly approverDepartmentId?: string | null;
  readonly resourceOwnerId?: string | null;
}

export interface BudgetAccessQueryResult {
  readonly allow: boolean;
  readonly rootSpanId: string;
  readonly denyReason?: string;
  readonly firstFailureSpanId?: string;
}

/** 슬라이스 외부 (auth bounded context) 가 구현해 주입한다. */
export abstract class BudgetAccessQueryPort {
  abstract check(input: BudgetAccessQueryInput): Promise<BudgetAccessQueryResult>;
}

/**
 * Budget request 가 등록된 직후 policy registry 에 등록하기 위한 별도 port.
 * Pass 2 lifecycle (UNREGISTERED → REGISTERED) 진입.
 */
export abstract class BudgetPolicyLifecyclePort {
  abstract onCreated(input: {
    readonly requestId: string;
    readonly requesterId: string;
  }): Promise<void>;
}
