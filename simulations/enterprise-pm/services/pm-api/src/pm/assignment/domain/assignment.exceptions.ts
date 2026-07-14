// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free. Nest 의존 없음.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - ValidationError → 400 / VALIDATION_ERROR
 *   - ConflictError   → 409 / CONFLICT
 *   - NotFoundError   → 404 / NOT_FOUND
 *
 * 본 슬라이스는 위 표준 이름 중 ValidationError 와 ConflictError 를 사용한다.
 */
export class AssignmentDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AssignmentDomainException';
  }
}

/** Assignment ID 가 비어 있는 경우 (HTTP 400 매핑). */
export class InvalidAssignmentIdException extends AssignmentDomainException {
  constructor() {
    super('INVALID_ASSIGNMENT_ID', 'AssignmentId must not be empty.');
    // mapDomainErrorToHttp 표준 이름
    this.name = 'ValidationError';
  }
}

/** 이미 cancelled 상태인 assignment 를 다시 assign 하려고 했을 때 (HTTP 409). */
export class AssignmentCancelledException extends AssignmentDomainException {
  constructor() {
    super('ASSIGNMENT_CANCELLED', 'Cancelled assignment cannot be assigned.');
    this.name = 'ConflictError';
  }
}
