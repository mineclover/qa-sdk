// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/** subscription 의 active 플래그를 변경하는 명령. */
export interface SetSubscriptionActiveCommand {
  readonly userId: string;
  readonly eventType: string;
  readonly isActive: boolean;
  readonly traceId?: string;
  readonly correlationId?: string;
}
