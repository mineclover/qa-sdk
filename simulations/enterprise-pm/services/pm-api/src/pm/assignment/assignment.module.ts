// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from '@nestjs/common';
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from '@qa-sdk/sim-domain-slice-kit';

import { PM_DB_INSTANCE, type PmDbInstanceHandle } from '../pm-db.module.js';

import { AssignmentRepositoryPort } from './application/ports/assignment-repository.port.js';
import { AssignmentReadModelQuery } from './application/queries/assignment-read-model.query.js';
import { AssignmentUseCase } from './application/use-cases/assignment.use-case.js';

import { createAssignmentRepository } from './infrastructure/persistence/assignment.repository.js';
import { createAssignmentTransactionPort } from './infrastructure/transaction/assignment.transaction.js';
import { createAssignmentOutboxPort } from './infrastructure/outbox/assignment.outbox.js';
import { createAssignmentLogger } from './infrastructure/logging/assignment.logger.js';
import { RepositoryAssignmentReadModel } from './infrastructure/read-model/assignment.read-model.js';

import { AssignmentController } from './presentation/http/assignment.controller.js';
import { AssignmentDetailBff } from './presentation/bff/assignment-detail.bff.js';
import { AssignmentDetailController } from './presentation/bff/assignment-detail.controller.js';

const ASSIGNMENT_TRANSACTION_PORT = Symbol.for('sim-pm-api/assignment/TransactionPort');
const ASSIGNMENT_OUTBOX_PORT = Symbol.for('sim-pm-api/assignment/OutboxPort');

const repositoryProvider: Provider = {
  provide: AssignmentRepositoryPort,
  useFactory: (handle: PmDbInstanceHandle) =>
    createAssignmentRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: ASSIGNMENT_TRANSACTION_PORT,
  useFactory: (handle: PmDbInstanceHandle): TransactionPort =>
    createAssignmentTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: ASSIGNMENT_OUTBOX_PORT,
  useFactory: (handle: PmDbInstanceHandle): OutboxPort =>
    createAssignmentOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createAssignmentLogger(),
};

const readModelProvider: Provider = {
  provide: AssignmentReadModelQuery,
  useFactory: (repo: AssignmentRepositoryPort) => new RepositoryAssignmentReadModel(repo),
  inject: [AssignmentRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: AssignmentUseCase,
  useFactory: (
    repo: AssignmentRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new AssignmentUseCase(repo, outbox, transaction, logger),
  inject: [
    AssignmentRepositoryPort,
    ASSIGNMENT_OUTBOX_PORT,
    ASSIGNMENT_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
  ],
};

const detailBffProvider: Provider = {
  provide: AssignmentDetailBff,
  useFactory: (rm: AssignmentReadModelQuery, logger: LoggerPort) =>
    new AssignmentDetailBff(rm, logger),
  inject: [AssignmentReadModelQuery, SLICE_LOGGER_PORT],
};

/**
 * Assignment 슬라이스의 NestJS 모듈.
 *
 * - PmDbModule (forRoot, global) 이 export 한 PM_DB_INSTANCE 를 의존.
 * - SLICE_LOGGER_PORT 를 본 모듈 안에서 직접 provide 하여 다른 서비스/모듈
 *   부트스트랩 순서에 의존하지 않도록 한다.
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
  controllers: [AssignmentController, AssignmentDetailController],
  exports: [
    AssignmentRepositoryPort,
    AssignmentReadModelQuery,
    AssignmentUseCase,
    AssignmentDetailBff,
  ],
})
export class AssignmentSliceModule {}
