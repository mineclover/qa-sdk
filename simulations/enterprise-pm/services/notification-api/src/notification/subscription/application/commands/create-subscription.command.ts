// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { SubscriptionChannel } from '../../domain/subscription.types.js';

/** 새 subscription 을 생성하라는 명령 (use-case 입력). */
export interface CreateSubscriptionCommand {
  readonly userId: string;
  readonly eventType: string;
  readonly channel: SubscriptionChannel;
  readonly isActive?: boolean;
  readonly traceId?: string;
  readonly correlationId?: string;
}
