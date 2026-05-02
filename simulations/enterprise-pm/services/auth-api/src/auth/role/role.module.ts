// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from "@qa-sdk/sim-domain-slice-kit";

import {
  AUTH_DB_INSTANCE,
  type AuthDbInstanceHandle,
} from "../auth-db.module.js";

import { RoleRepositoryPort } from "./application/ports/role-repository.port.js";
import { RoleReadModelQuery } from "./application/queries/role-read-model.query.js";
import { RoleUseCase } from "./application/use-cases/role.use-case.js";

import { createRoleRepository } from "./infrastructure/persistence/role.repository.js";
import { createRoleTransactionPort } from "./infrastructure/transaction/role.drizzle-transaction.js";
import { createRoleOutboxPort } from "./infrastructure/outbox/role.outbox.js";
import { createRoleLogger } from "./infrastructure/logging/role.logger.js";
import { RepositoryRoleReadModel } from "./infrastructure/read-model/role.read-model.js";

import { RoleController } from "./presentation/http/role.controller.js";

const ROLE_TRANSACTION_PORT = Symbol.for("sim-auth-api/role/TransactionPort");
const ROLE_OUTBOX_PORT = Symbol.for("sim-auth-api/role/OutboxPort");

const repositoryProvider: Provider = {
  provide: RoleRepositoryPort,
  useFactory: (handle: AuthDbInstanceHandle) =>
    createRoleRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: ROLE_TRANSACTION_PORT,
  useFactory: (handle: AuthDbInstanceHandle): TransactionPort =>
    createRoleTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: ROLE_OUTBOX_PORT,
  useFactory: (handle: AuthDbInstanceHandle): OutboxPort =>
    createRoleOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createRoleLogger(),
};

const readModelProvider: Provider = {
  provide: RoleReadModelQuery,
  useFactory: (repo: RoleRepositoryPort) => new RepositoryRoleReadModel(repo),
  inject: [RoleRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: RoleUseCase,
  useFactory: (
    repo: RoleRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new RoleUseCase(repo, outbox, transaction, logger),
  inject: [
    RoleRepositoryPort,
    ROLE_OUTBOX_PORT,
    ROLE_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
  ],
};

/** Role 슬라이스의 NestJS 모듈. */
@Module({
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    readModelProvider,
    useCaseProvider,
  ],
  controllers: [RoleController],
  exports: [RoleRepositoryPort, RoleReadModelQuery, RoleUseCase],
})
export class RoleSliceModule {}
