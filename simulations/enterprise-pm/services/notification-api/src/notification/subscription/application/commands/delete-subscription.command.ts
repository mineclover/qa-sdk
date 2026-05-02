// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/** subscription 을 삭제하는 명령. */
export interface DeleteSubscriptionCommand {
  readonly userId: string;
  readonly eventType: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
