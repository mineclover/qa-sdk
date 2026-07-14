// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from '@nestjs/common';
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from '@qa-sdk/sim-domain-slice-kit';

import { AUTH_DB_INSTANCE, type AuthDbInstanceHandle } from '../auth-db.module.js';

import { DepartmentRepositoryPort } from './application/ports/department-repository.port.js';
import { DepartmentReadModelQuery } from './application/queries/department-read-model.query.js';
import { DepartmentUseCase } from './application/use-cases/department.use-case.js';

import { createDepartmentRepository } from './infrastructure/persistence/department.repository.js';
import { createDepartmentTransactionPort } from './infrastructure/transaction/department.drizzle-transaction.js';
import { createDepartmentOutboxPort } from './infrastructure/outbox/department.outbox.js';
import { createDepartmentLogger } from './infrastructure/logging/department.logger.js';
import { RepositoryDepartmentReadModel } from './infrastructure/read-model/department.read-model.js';

import { DepartmentController } from './presentation/http/department.controller.js';

const DEPARTMENT_TRANSACTION_PORT = Symbol.for('sim-auth-api/department/TransactionPort');
const DEPARTMENT_OUTBOX_PORT = Symbol.for('sim-auth-api/department/OutboxPort');

const repositoryProvider: Provider = {
  provide: DepartmentRepositoryPort,
  useFactory: (handle: AuthDbInstanceHandle) =>
    createDepartmentRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: DEPARTMENT_TRANSACTION_PORT,
  useFactory: (handle: AuthDbInstanceHandle): TransactionPort =>
    createDepartmentTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: DEPARTMENT_OUTBOX_PORT,
  useFactory: (handle: AuthDbInstanceHandle): OutboxPort =>
    createDepartmentOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createDepartmentLogger(),
};

const readModelProvider: Provider = {
  provide: DepartmentReadModelQuery,
  useFactory: (repo: DepartmentRepositoryPort) => new RepositoryDepartmentReadModel(repo),
  inject: [DepartmentRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: DepartmentUseCase,
  useFactory: (
    repo: DepartmentRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new DepartmentUseCase(repo, outbox, transaction, logger),
  inject: [
    DepartmentRepositoryPort,
    DEPARTMENT_OUTBOX_PORT,
    DEPARTMENT_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
  ],
};

/** Department 슬라이스의 NestJS 모듈. */
@Module({
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    readModelProvider,
    useCaseProvider,
  ],
  controllers: [DepartmentController],
  exports: [DepartmentRepositoryPort, DepartmentReadModelQuery, DepartmentUseCase],
})
export class DepartmentSliceModule {}
