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

import { SubscriptionRepositoryPort } from "./application/ports/subscription-repository.port.js";
import { SubscriptionReadModelQuery } from "./application/queries/subscription-read-model.query.js";
import { SubscriptionUseCase } from "./application/use-cases/subscription.use-case.js";
import {
  AlwaysTrueUserQuery,
  SubscriptionUserQueryPort,
} from "./application/ports/user-query.port.js";

import { createSubscriptionRepository } from "./infrastructure/persistence/subscription.repository.js";
import { createSubscriptionTransactionPort } from "./infrastructure/transaction/subscription.drizzle-transaction.js";
import { createSubscriptionOutboxPort } from "./infrastructure/outbox/subscription.outbox.js";
import { createSubscriptionLogger } from "./infrastructure/logging/subscription.logger.js";
import { RepositorySubscriptionReadModel } from "./infrastructure/read-model/subscription.read-model.js";

import { SubscriptionController } from "./presentation/http/subscription.controller.js";
import { SubscriptionDetailBff } from "./presentation/bff/subscription-detail.bff.js";
import { SubscriptionDetailController } from "./presentation/bff/subscription-detail.controller.js";

// production user-query 어댑터 (외부 컴포지션용 re-export — 모듈 자체는
// 기본값으로 AlwaysTrueUserQuery 를 유지). NestJS override 또는 dynamic
// composition 을 통해 InProcess/Http 어댑터로 교체 가능.
export {
  InProcessSubscriptionUserQuery,
  type UserReadModelLike,
} from "./infrastructure/adapters/in-process-user-query.adapter.js";
export {
  HttpSubscriptionUserQuery,
  type HttpSubscriptionUserQueryOptions,
  type FetchLike,
} from "./infrastructure/adapters/http-user-query.adapter.js";

const SUB_TRANSACTION_PORT = Symbol.for("sim-notification-api/subscription/TransactionPort");
const SUB_OUTBOX_PORT = Symbol.for("sim-notification-api/subscription/OutboxPort");

const repositoryProvider: Provider = {
  provide: SubscriptionRepositoryPort,
  useFactory: (handle: NotifDbInstanceHandle) =>
    createSubscriptionRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [NOTIF_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: SUB_TRANSACTION_PORT,
  useFactory: (handle: NotifDbInstanceHandle): TransactionPort =>
    createSubscriptionTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [NOTIF_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: SUB_OUTBOX_PORT,
  useFactory: (handle: NotifDbInstanceHandle): OutboxPort =>
    createSubscriptionOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [NOTIF_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createSubscriptionLogger(),
};

const readModelProvider: Provider = {
  provide: SubscriptionReadModelQuery,
  useFactory: (repo: SubscriptionRepositoryPort) =>
    new RepositorySubscriptionReadModel(repo),
  inject: [SubscriptionRepositoryPort],
};

/**
 * SubscriptionUserQueryPort 어댑터 — cross-domain anti-corruption seam.
 *
 * sim-notification-api 는 user 영속을 소유하지 않는다. 기본 어댑터는
 * AlwaysTrueUserQuery 를 사용해 user 존재를 항상 true 로 가정한다 (dev/test
 * fail-open). auth-api 가 ready 되면 BFF / anti-corruption 레이어가 본 토큰의
 * 실제 구현을 주입한다.
 *
 * Production 어댑터:
 *   - InProcessSubscriptionUserQuery — 단일 프로세스 (시뮬/통합 테스트). 외부
 *     컴포지션이 auth-api 의 UserReadModelQuery 를 구조적 타이핑으로 주입.
 *   - HttpSubscriptionUserQuery — cross-process (운영 형태). auth-api 의
 *     `GET /users/:id` 호출 + AbortSignal.timeout + fail-open.
 *
 * 두 production 어댑터 모두 본 모듈의 top-level 에서 re-export 됨. 컴포지션
 * 루트 (시나리오/통합 환경) 는 NestJS `Test.overrideProvider` 또는 동등한
 * mechanism 으로 본 provider 를 swap 한다.
 */
const userQueryProvider: Provider = {
  provide: SubscriptionUserQueryPort,
  useFactory: () => new AlwaysTrueUserQuery(),
};

const useCaseProvider: Provider = {
  provide: SubscriptionUseCase,
  useFactory: (
    repo: SubscriptionRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    userQuery: SubscriptionUserQueryPort,
  ) => new SubscriptionUseCase(repo, outbox, transaction, logger, userQuery),
  inject: [
    SubscriptionRepositoryPort,
    SUB_OUTBOX_PORT,
    SUB_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
    SubscriptionUserQueryPort,
  ],
};

const detailBffProvider: Provider = {
  provide: SubscriptionDetailBff,
  useFactory: (rm: SubscriptionReadModelQuery, logger: LoggerPort) =>
    new SubscriptionDetailBff(rm, logger),
  inject: [SubscriptionReadModelQuery, SLICE_LOGGER_PORT],
};

/**
 * Subscription 슬라이스의 NestJS 모듈.
 *
 * - NotificationDbModule (forRoot, global) 이 export 한 NOTIF_DB_INSTANCE 를 의존.
 * - SubscriptionUserQueryPort 의 기본 어댑터는 AlwaysTrueUserQuery
 *   (anti-corruption seam — auth-api 부재 환경에서 fail-open).
 * - http controller + bff controller (GET /bff/subscriptions/:userId/:eventType) 노출.
 */
@Module({
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    readModelProvider,
    userQueryProvider,
    useCaseProvider,
    detailBffProvider,
  ],
  controllers: [SubscriptionController, SubscriptionDetailController],
  exports: [
    SubscriptionRepositoryPort,
    SubscriptionReadModelQuery,
    SubscriptionUseCase,
    SubscriptionUserQueryPort,
    SubscriptionDetailBff,
  ],
})
export class SubscriptionSliceModule {}
