// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { toNotificationId, toRecipientUserId } from "./notification.ids.js";
import { NotificationTerminalStateException } from "./notification.exceptions.js";
import type { NotificationProps, NotificationSnapshot, NotificationStatus } from "./notification.types.js";

/**
 * Notification Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 상태 전이는 새 인스턴스 반환 (불변)
 * - invariant: read / failed 는 terminal — 추가 전이 시 ConflictError
 */
export class NotificationEntity {
  private constructor(private readonly props: NotificationProps) {}

  static create(input: {
    readonly id: string;
    readonly recipientUserId: string;
    readonly type: string;
    readonly title: string;
    readonly body: string;
    readonly now?: Date;
  }): NotificationEntity {
    const now = input.now ?? new Date();
    return new NotificationEntity({
      id: toNotificationId(input.id),
      recipientUserId: toRecipientUserId(input.recipientUserId),
      type: input.type,
      title: input.title,
      body: input.body,
      status: "pending",
      createdAt: now,
      sentAt: null,
      readAt: null,
    });
  }

  static rehydrate(snapshot: NotificationSnapshot): NotificationEntity {
    return new NotificationEntity({
      id: toNotificationId(snapshot.id),
      recipientUserId: toRecipientUserId(snapshot.recipientUserId),
      type: snapshot.type,
      title: snapshot.title,
      body: snapshot.body,
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      sentAt: snapshot.sentAt ? new Date(snapshot.sentAt) : null,
      readAt: snapshot.readAt ? new Date(snapshot.readAt) : null,
    });
  }

  /** pending → sent. terminal 상태에서는 ConflictError. */
  markSent(now = new Date()): NotificationEntity {
    this.assertNotTerminal("markSent");
    return new NotificationEntity({ ...this.props, status: "sent", sentAt: now });
  }

  /** sent/pending → read. terminal 상태에서는 ConflictError. */
  markRead(now = new Date()): NotificationEntity {
    this.assertNotTerminal("markRead");
    return new NotificationEntity({ ...this.props, status: "read", readAt: now });
  }

  /** pending/sent → failed. read 에서는 ConflictError (이미 성공 종료). */
  markFailed(): NotificationEntity {
    if (this.props.status === "read") {
      throw new NotificationTerminalStateException(this.props.status, "markFailed");
    }
    return new NotificationEntity({ ...this.props, status: "failed" });
  }

  private assertNotTerminal(transition: string): void {
    if (this.props.status === "read" || this.props.status === "failed") {
      throw new NotificationTerminalStateException(this.props.status, transition);
    }
  }

  toSnapshot(): NotificationSnapshot {
    return {
      id: this.props.id,
      recipientUserId: this.props.recipientUserId,
      type: this.props.type,
      title: this.props.title,
      body: this.props.body,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      sentAt: this.props.sentAt ? this.props.sentAt.toISOString() : null,
      readAt: this.props.readAt ? this.props.readAt.toISOString() : null,
    };
  }

  get id(): string {
    return this.props.id;
  }

  get status(): NotificationStatus {
    return this.props.status;
  }

  get recipientUserId(): string {
    return this.props.recipientUserId;
  }
}
