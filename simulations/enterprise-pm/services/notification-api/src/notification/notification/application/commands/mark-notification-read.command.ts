// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/** notification 을 read 로 전이시키는 명령. */
export interface MarkNotificationReadCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
