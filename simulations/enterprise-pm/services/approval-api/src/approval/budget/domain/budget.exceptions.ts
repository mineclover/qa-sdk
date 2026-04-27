// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free. Nest 의존 없음.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - ValidationError    → 400 / VALIDATION_ERROR
 *   - ConflictError      → 409 / CONFLICT
 *   - NotFoundError      → 404 / NOT_FOUND
 *   - UnauthorizedError  → 401
 *   - ForbiddenError     → 403
 */
export class BudgetDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BudgetDomainException";
  }
}

/** Budget request id 가 비어 있는 경우 → 400. */
export class InvalidBudgetIdException extends BudgetDomainException {
  constructor() {
    super("INVALID_BUDGET_ID", "BudgetRequestId must not be empty.");
    this.name = "ValidationError";
  }
}

/** amount <= 0 등 잘못된 금액 → 400. */
export class InvalidBudgetAmountException extends BudgetDomainException {
  constructor(amount: number) {
    super("INVALID_BUDGET_AMOUNT", `Budget amount must be positive: ${amount}.`);
    this.name = "ValidationError";
  }
}

/** 현재 상태에서 호출할 수 없는 전이 → 409. */
export class BudgetTransitionConflictException extends BudgetDomainException {
  constructor(from: string, action: string) {
    super("BUDGET_TRANSITION_CONFLICT", `Invalid budget transition from ${from} via ${action}.`);
    this.name = "ConflictError";
  }
}

/** 결정 단계 mismatch (예: in_review 가 아닌 상태에서 decide) → 409. */
export class BudgetStageConflictException extends BudgetDomainException {
  constructor(message: string) {
    super("BUDGET_STAGE_CONFLICT", message);
    this.name = "ConflictError";
  }
}

/** 존재하지 않는 budget request → 404. */
export class BudgetNotFoundException extends BudgetDomainException {
  constructor(id: string) {
    super("BUDGET_NOT_FOUND", `Budget request not found: ${id}.`);
    this.name = "NotFoundError";
  }
}
