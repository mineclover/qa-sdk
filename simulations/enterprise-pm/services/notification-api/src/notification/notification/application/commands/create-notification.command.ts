// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/** 새 notification 을 생성하라는 명령 (use-case 입력). */
export interface CreateNotificationCommand {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
