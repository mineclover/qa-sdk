// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { toEventTypeKey, toSubscriberUserId } from './subscription.ids.js';
import type {
  SubscriptionChannel,
  SubscriptionProps,
  SubscriptionSnapshot,
} from './subscription.types.js';

/**
 * Subscription Aggregate Root.
 *
 * - private constructor + named factories.
 * - 모든 상태 전이는 새 인스턴스 반환 (불변).
 * - identity = (userId, eventType) 복합키.
 */
export class SubscriptionEntity {
  private constructor(private readonly props: SubscriptionProps) {}

  static create(input: {
    readonly userId: string;
    readonly eventType: string;
    readonly channel: SubscriptionChannel;
    readonly isActive?: boolean;
    readonly now?: Date;
  }): SubscriptionEntity {
    return new SubscriptionEntity({
      userId: toSubscriberUserId(input.userId),
      eventType: toEventTypeKey(input.eventType),
      channel: input.channel,
      isActive: input.isActive ?? true,
      createdAt: input.now ?? new Date(),
    });
  }

  static rehydrate(snapshot: SubscriptionSnapshot): SubscriptionEntity {
    return new SubscriptionEntity({
      userId: toSubscriberUserId(snapshot.userId),
      eventType: toEventTypeKey(snapshot.eventType),
      channel: snapshot.channel,
      isActive: snapshot.isActive,
      createdAt: new Date(snapshot.createdAt),
    });
  }

  /** active toggle — 새 인스턴스 반환. */
  setActive(isActive: boolean): SubscriptionEntity {
    if (this.props.isActive === isActive) return this;
    return new SubscriptionEntity({ ...this.props, isActive });
  }

  toSnapshot(): SubscriptionSnapshot {
    return {
      userId: this.props.userId,
      eventType: this.props.eventType,
      channel: this.props.channel,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  get userId(): string {
    return this.props.userId;
  }
  get eventType(): string {
    return this.props.eventType;
  }
  get channel(): SubscriptionChannel {
    return this.props.channel;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
}

/** event-type matching helper — 정확 일치 + "<domain>.*" wildcard. */
export function matchesEventType(pattern: string, actual: string): boolean {
  if (pattern === actual) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return actual.startsWith(prefix + '.');
  }
  return false;
}
