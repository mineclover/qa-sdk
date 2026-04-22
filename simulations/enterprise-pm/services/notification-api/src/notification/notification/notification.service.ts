// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_REPOSITORY } from "../notification-db.module.js";
import type { NotificationRepository } from "../shared/port.js";
import type {
  Notification,
  NotificationCreate,
  NotificationStatus,
} from "../shared/types.js";

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository,
  ) {}

  create(args: NotificationCreate): Promise<Notification> {
    return this.repo.createNotification(args);
  }
  find(id: string): Promise<Notification | null> {
    return this.repo.findNotification(id);
  }
  listForUser(userId: string, status?: NotificationStatus): Promise<Notification[]> {
    return this.repo.listNotificationsForUser(userId, status);
  }
  markSent(id: string): Promise<Notification> {
    return this.repo.markAsSent(id);
  }
  markRead(id: string): Promise<Notification> {
    return this.repo.markAsRead(id);
  }
  markFailed(id: string): Promise<Notification> {
    return this.repo.markAsFailed(id);
  }
}
