// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free. Nest 의존 없음.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - ValidationError → 400 / VALIDATION_ERROR
 *   - ConflictError   → 409 / CONFLICT
 *   - NotFoundError   → 404 / NOT_FOUND
 */
export class NotificationDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NotificationDomainException';
  }
}

/** Notification ID 가 비어있는 경우 (HTTP 400). */
export class InvalidNotificationIdException extends NotificationDomainException {
  constructor() {
    super('INVALID_NOTIFICATION_ID', 'NotificationId must not be empty.');
    this.name = 'ValidationError';
  }
}

/** Notification 미존재 (HTTP 404). */
export class NotificationNotFoundException extends NotificationDomainException {
  constructor(public readonly notificationId: string) {
    super('NOTIFICATION_NOT_FOUND', `Notification not found: ${notificationId}`);
    this.name = 'NotFoundError';
  }
}

/** terminal 상태(read 또는 failed)에서 추가 전이 시도 (HTTP 409). */
export class NotificationTerminalStateException extends NotificationDomainException {
  constructor(
    public readonly currentStatus: string,
    public readonly attemptedTransition: string,
  ) {
    super(
      'NOTIFICATION_TERMINAL_STATE',
      `Notification in '${currentStatus}' is terminal; cannot transition via '${attemptedTransition}'.`,
    );
    this.name = 'ConflictError';
  }
}
