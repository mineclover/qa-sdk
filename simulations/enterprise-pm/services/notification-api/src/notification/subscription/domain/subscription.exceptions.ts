// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - ValidationError → 400
 *   - ConflictError   → 409
 *   - NotFoundError   → 404
 */
export class SubscriptionDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SubscriptionDomainException";
  }
}

/** 빈 userId 또는 eventType (HTTP 400). */
export class InvalidSubscriptionIdException extends SubscriptionDomainException {
  constructor(reason: string) {
    super("INVALID_SUBSCRIPTION_ID", `Subscription identity invalid: ${reason}`);
    this.name = "ValidationError";
  }
}

/** 미존재 subscription (HTTP 404). */
export class SubscriptionNotFoundException extends SubscriptionDomainException {
  constructor(public readonly userId: string, public readonly eventType: string) {
    super(
      "SUBSCRIPTION_NOT_FOUND",
      `Subscription not found: ${userId}/${eventType}`,
    );
    this.name = "NotFoundError";
  }
}

/** cross-domain user 존재 확인 실패 (HTTP 409). */
export class SubscriptionUserUnknownException extends SubscriptionDomainException {
  constructor(public readonly userId: string) {
    super("SUBSCRIPTION_USER_UNKNOWN", `Recipient user does not exist: ${userId}`);
    this.name = "ConflictError";
  }
}
