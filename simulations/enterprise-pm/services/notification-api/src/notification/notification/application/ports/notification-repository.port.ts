// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { NotificationEntity } from '../../domain/index.js';
import type { NotificationStatus } from '../../domain/notification.types.js';
import type { NotificationTransactionScope } from './notification-transaction.port.js';

/**
 * Notification Aggregate 의 영속 추상.
 *
 * - dialect (sqlite/pg) 무관 — 어댑터에서 분기.
 * - save 는 트랜잭션 스코프를 받아 동일 트랜잭션 내 INSERT/UPDATE.
 */
export abstract class NotificationRepositoryPort {
  abstract save(entity: NotificationEntity, scope: NotificationTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<NotificationEntity | null>;
  abstract listForUser(
    recipientUserId: string,
    status?: NotificationStatus,
  ): Promise<NotificationEntity[]>;
}
