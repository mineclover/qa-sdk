// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import {
  NotificationReadModelQuery,
  type NotificationDetailReadModel,
  type NotificationListItemReadModel,
} from '../../application/queries/notification-read-model.query.js';
import type { NotificationRepositoryPort } from '../../application/ports/notification-repository.port.js';
import type { NotificationStatus } from '../../domain/notification.types.js';

/**
 * Repository 위에 얇게 얹은 Read Model.
 *
 * Phase 2 단순 슬라이스에서는 read model projector 가 없고 entity 를 그대로
 * detail/list DTO 로 매핑한다.
 */
export class RepositoryNotificationReadModel extends NotificationReadModelQuery {
  constructor(private readonly repository: NotificationRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<NotificationDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    const snapshot = entity.toSnapshot();
    return {
      id: snapshot.id,
      recipientUserId: snapshot.recipientUserId,
      type: snapshot.type,
      title: snapshot.title,
      body: snapshot.body,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      sentAt: snapshot.sentAt,
      readAt: snapshot.readAt,
    };
  }

  async listForUser(
    recipientUserId: string,
    status?: string,
  ): Promise<NotificationListItemReadModel[]> {
    const items = await this.repository.listForUser(
      recipientUserId,
      status as NotificationStatus | undefined,
    );
    return items.map((entity) => {
      const s = entity.toSnapshot();
      return {
        id: s.id,
        type: s.type,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
      };
    });
  }
}
