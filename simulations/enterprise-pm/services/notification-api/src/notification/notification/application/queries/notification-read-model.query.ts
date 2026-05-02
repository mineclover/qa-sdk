// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/** Read-side detail DTO — command 측 entity 와 독립. */
export interface NotificationDetailReadModel {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
  readonly sentAt: string | null;
  readonly readAt: string | null;
}

export interface NotificationListItemReadModel {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly status: string;
  readonly createdAt: string;
}

/** Read 전용 추상 (CQRS — Primary DB 직접 read 금지, Read Model 우선). */
export abstract class NotificationReadModelQuery {
  abstract findDetail(id: string): Promise<NotificationDetailReadModel | null>;
  abstract listForUser(
    recipientUserId: string,
    status?: string,
  ): Promise<NotificationListItemReadModel[]>;
}
