// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * User 도메인 예외 — framework-free.
 *
 * mapDomainErrorToHttp 가 name 으로 status 결정:
 *   ValidationError → 400
 *   ConflictError   → 409
 *   NotFoundError   → 404
 */
export class UserDomainException extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "UserDomainException";
  }
}

/** 빈 UserId / 빈 email / 빈 displayName (HTTP 400). */
export class InvalidUserInputException extends UserDomainException {
  constructor(reason: string) {
    super("INVALID_USER_INPUT", reason);
    this.name = "ValidationError";
  }
}

/** email 중복 (HTTP 409). */
export class DuplicateUserEmailException extends UserDomainException {
  constructor(email: string) {
    super("DUPLICATE_USER_EMAIL", `User already exists with email: ${email}`);
    this.name = "ConflictError";
  }
}

/** User 미존재 (HTTP 404). */
export class UserNotFoundException extends UserDomainException {
  constructor(userId: string) {
    super("USER_NOT_FOUND", `User not found: ${userId}`);
    this.name = "NotFoundError";
  }
}
