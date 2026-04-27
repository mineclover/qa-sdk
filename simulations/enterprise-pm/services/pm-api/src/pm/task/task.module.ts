// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from "@qa-sdk/sim-domain-slice-kit";

import {
  PM_DB_INSTANCE,
  type PmDbInstanceHandle,
} from "../pm-db.module.js";

import { TaskRepositoryPort } from "./application/ports/task-repository.port.js";
import { TaskReadModelQuery } from "./application/queries/task-read-model.query.js";
import { TaskUseCase } from "./application/use-cases/task.use-case.js";

import { createTaskRepository } from "./infrastructure/persistence/task.repository.js";
import { createTaskTransactionPort } from "./infrastructure/transaction/task.transaction.js";
import { createTaskOutboxPort } from "./infrastructure/outbox/task.outbox.js";
import { createTaskLogger } from "./infrastructure/logging/task.logger.js";
import { RepositoryTaskReadModel } from "./infrastructure/read-model/task.read-model.js";

import { TaskController } from "./presentation/http/task.controller.js";

const TASK_TRANSACTION_PORT = Symbol.for("sim-pm-api/task/TransactionPort");
const TASK_OUTBOX_PORT = Symbol.for("sim-pm-api/task/OutboxPort");

const repositoryProvider: Provider = {
  provide: TaskRepositoryPort,
  useFactory: (handle: PmDbInstanceHandle) =>
    createTaskRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: TASK_TRANSACTION_PORT,
  useFactory: (handle: PmDbInstanceHandle): TransactionPort =>
    createTaskTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: TASK_OUTBOX_PORT,
  useFactory: (handle: PmDbInstanceHandle): OutboxPort =>
    createTaskOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createTaskLogger(),
};

const readModelProvider: Provider = {
  provide: TaskReadModelQuery,
  useFactory: (repo: TaskRepositoryPort) => new RepositoryTaskReadModel(repo),
  inject: [TaskRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: TaskUseCase,
  useFactory: (
    repo: TaskRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new TaskUseCase(repo, outbox, transaction, logger),
  inject: [
    TaskRepositoryPort,
    TASK_OUTBOX_PORT,
    TASK_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
  ],
};

/**
 * Task 슬라이스의 NestJS 모듈.
 *
 * - PmDbModule (forRoot, global) 의 PM_DB_INSTANCE 의존.
 * - SLICE_LOGGER_PORT 는 본 모듈 내부에서 직접 provide.
 */
@Module({
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    readModelProvider,
    useCaseProvider,
  ],
  controllers: [TaskController],
  exports: [TaskRepositoryPort, TaskReadModelQuery, TaskUseCase],
})
export class TaskSliceModule {}
