// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from "@qa-sdk/sim-domain-slice-kit";

import {
  NOTIF_DB_INSTANCE,
  type NotifDbInstanceHandle,
} from "../notification-db.module.js";

import { NotificationRepositoryPort } from "./application/ports/notification-repository.port.js";
import { NotificationReadModelQuery } from "./application/queries/notification-read-model.query.js";
import { NotificationUseCase } from "./application/use-cases/notification.use-case.js";

import { createNotificationRepository } from "./infrastructure/persistence/notification.repository.js";
import { createNotificationTransactionPort } from "./infrastructure/transaction/notification.drizzle-transaction.js";
import { createNotificationOutboxPort } from "./infrastructure/outbox/notification.outbox.js";
import { createNotificationLogger } from "./infrastructure/logging/notification.logger.js";
import { RepositoryNotificationReadModel } from "./infrastructure/read-model/notification.read-model.js";

import { NotificationController } from "./presentation/http/notification.controller.js";
import { NotificationDetailBff } from "./presentation/bff/notification-detail.bff.js";
import { NotificationDetailController } from "./presentation/bff/notification-detail.controller.js";

const NOTIF_TRANSACTION_PORT = Symbol.for("sim-notification-api/notification/TransactionPort");
const NOTIF_OUTBOX_PORT = Symbol.for("sim-notification-api/notification/OutboxPort");

const repositoryProvider: Provider = {
  provide: NotificationRepositoryPort,
  useFactory: (handle: NotifDbInstanceHandle) =>
    createNotificationRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [NOTIF_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: NOTIF_TRANSACTION_PORT,
  useFactory: (handle: NotifDbInstanceHandle): TransactionPort =>
    createNotificationTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [NOTIF_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: NOTIF_OUTBOX_PORT,
  useFactory: (handle: NotifDbInstanceHandle): OutboxPort =>
    createNotificationOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [NOTIF_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createNotificationLogger(),
};

const readModelProvider: Provider = {
  provide: NotificationReadModelQuery,
  useFactory: (repo: NotificationRepositoryPort) =>
    new RepositoryNotificationReadModel(repo),
  inject: [NotificationRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: NotificationUseCase,
  useFactory: (
    repo: NotificationRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new NotificationUseCase(repo, outbox, transaction, logger),
  inject: [
    NotificationRepositoryPort,
    NOTIF_OUTBOX_PORT,
    NOTIF_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
  ],
};

const detailBffProvider: Provider = {
  provide: NotificationDetailBff,
  useFactory: (rm: NotificationReadModelQuery, logger: LoggerPort) =>
    new NotificationDetailBff(rm, logger),
  inject: [NotificationReadModelQuery, SLICE_LOGGER_PORT],
};

/**
 * Notification 슬라이스의 NestJS 모듈.
 *
 * - NotificationDbModule (forRoot, global) 이 export 한 NOTIF_DB_INSTANCE 를 의존.
 * - SLICE_LOGGER_PORT 를 본 모듈 안에서 직접 provide 하여 다른 슬라이스의
 *   logger 와 충돌하지 않도록 한다.
 * - http controller + bff controller (Phase 2 — GET /bff/notifications/:id) 노출.
 */
@Module({
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    readModelProvider,
    useCaseProvider,
    detailBffProvider,
  ],
  controllers: [NotificationController, NotificationDetailController],
  exports: [
    NotificationRepositoryPort,
    NotificationReadModelQuery,
    NotificationUseCase,
    NotificationDetailBff,
  ],
})
export class NotificationSliceModule {}
