// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from '@nestjs/common';
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from '@qa-sdk/sim-domain-slice-kit';

import { APPROVAL_DB_INSTANCE, type ApprovalDbInstanceHandle } from '../approval-db.module.js';

import { TimeOffRepositoryPort } from './application/ports/timeoff-repository.port.js';
import { TimeOffReadModelQuery } from './application/queries/timeoff-read-model.query.js';
import { TimeOffUseCase } from './application/use-cases/timeoff.use-case.js';

import { createTimeOffRepository } from './infrastructure/persistence/timeoff.repository.js';
import { createTimeOffTransactionPort } from './infrastructure/transaction/timeoff.transaction.js';
import { createTimeOffOutboxPort } from './infrastructure/outbox/timeoff.outbox.js';
import { createTimeOffLogger } from './infrastructure/logging/timeoff.logger.js';
import { RepositoryTimeOffReadModel } from './infrastructure/read-model/timeoff.read-model.js';

import { TimeOffController } from './presentation/http/timeoff.controller.js';
import { TimeOffDetailBff } from './presentation/bff/timeoff-detail.bff.js';
import { TimeOffDetailController } from './presentation/bff/timeoff-detail.controller.js';

const TIMEOFF_TRANSACTION_PORT = Symbol.for('sim-approval-api/timeoff/TransactionPort');
const TIMEOFF_OUTBOX_PORT = Symbol.for('sim-approval-api/timeoff/OutboxPort');

const repositoryProvider: Provider = {
  provide: TimeOffRepositoryPort,
  useFactory: (handle: ApprovalDbInstanceHandle) =>
    createTimeOffRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: TIMEOFF_TRANSACTION_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): TransactionPort =>
    createTimeOffTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: TIMEOFF_OUTBOX_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): OutboxPort =>
    createTimeOffOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createTimeOffLogger(),
};

const readModelProvider: Provider = {
  provide: TimeOffReadModelQuery,
  useFactory: (repo: TimeOffRepositoryPort) => new RepositoryTimeOffReadModel(repo),
  inject: [TimeOffRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: TimeOffUseCase,
  useFactory: (
    repo: TimeOffRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new TimeOffUseCase(repo, outbox, transaction, logger),
  inject: [TimeOffRepositoryPort, TIMEOFF_OUTBOX_PORT, TIMEOFF_TRANSACTION_PORT, SLICE_LOGGER_PORT],
};

const detailBffProvider: Provider = {
  provide: TimeOffDetailBff,
  useFactory: (rm: TimeOffReadModelQuery, logger: LoggerPort) => new TimeOffDetailBff(rm, logger),
  inject: [TimeOffReadModelQuery, SLICE_LOGGER_PORT],
};

/**
 * TimeOff 슬라이스의 NestJS 모듈 (registry naming = TimeoffSliceModule).
 *
 * - ApprovalDbModule (forRoot, global) 의 APPROVAL_DB_INSTANCE 에 의존.
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
    detailBffProvider,
  ],
  controllers: [TimeOffController, TimeOffDetailController],
  exports: [TimeOffRepositoryPort, TimeOffReadModelQuery, TimeOffUseCase, TimeOffDetailBff],
})
export class TimeoffSliceModule {}
