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

import { ExpenseRepositoryPort } from './application/ports/expense-repository.port.js';
import { ExpenseReadModelQuery } from './application/queries/expense-read-model.query.js';
import { ExpenseUseCase } from './application/use-cases/expense.use-case.js';

import { createExpenseRepository } from './infrastructure/persistence/expense.repository.js';
import { createExpenseTransactionPort } from './infrastructure/transaction/expense.transaction.js';
import { createExpenseOutboxPort } from './infrastructure/outbox/expense.outbox.js';
import { createExpenseLogger } from './infrastructure/logging/expense.logger.js';
import { RepositoryExpenseReadModel } from './infrastructure/read-model/expense.read-model.js';

import { ExpenseController } from './presentation/http/expense.controller.js';
import { ExpenseDetailBff } from './presentation/bff/expense-detail.bff.js';
import { ExpenseDetailController } from './presentation/bff/expense-detail.controller.js';

const EXPENSE_TRANSACTION_PORT = Symbol.for('sim-approval-api/expense/TransactionPort');
const EXPENSE_OUTBOX_PORT = Symbol.for('sim-approval-api/expense/OutboxPort');

const repositoryProvider: Provider = {
  provide: ExpenseRepositoryPort,
  useFactory: (handle: ApprovalDbInstanceHandle) =>
    createExpenseRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: EXPENSE_TRANSACTION_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): TransactionPort =>
    createExpenseTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: EXPENSE_OUTBOX_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): OutboxPort =>
    createExpenseOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createExpenseLogger(),
};

const readModelProvider: Provider = {
  provide: ExpenseReadModelQuery,
  useFactory: (repo: ExpenseRepositoryPort) => new RepositoryExpenseReadModel(repo),
  inject: [ExpenseRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: ExpenseUseCase,
  useFactory: (
    repo: ExpenseRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new ExpenseUseCase(repo, outbox, transaction, logger),
  inject: [ExpenseRepositoryPort, EXPENSE_OUTBOX_PORT, EXPENSE_TRANSACTION_PORT, SLICE_LOGGER_PORT],
};

const detailBffProvider: Provider = {
  provide: ExpenseDetailBff,
  useFactory: (rm: ExpenseReadModelQuery, logger: LoggerPort) => new ExpenseDetailBff(rm, logger),
  inject: [ExpenseReadModelQuery, SLICE_LOGGER_PORT],
};

/**
 * Expense 슬라이스의 NestJS 모듈.
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
  controllers: [ExpenseController, ExpenseDetailController],
  exports: [ExpenseRepositoryPort, ExpenseReadModelQuery, ExpenseUseCase, ExpenseDetailBff],
})
export class ExpenseSliceModule {}
