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

import { MemberRepositoryPort } from './application/ports/member-repository.port.js';
import { MemberReadModelQuery } from './application/queries/member-read-model.query.js';
import { MemberUseCase } from './application/use-cases/member.use-case.js';

import { createMemberRepository } from './infrastructure/persistence/member.repository.js';
import { createMemberTransactionPort } from './infrastructure/transaction/member.transaction.js';
import { createMemberOutboxPort } from './infrastructure/outbox/member.outbox.js';
import { createMemberLogger } from './infrastructure/logging/member.logger.js';
import { RepositoryMemberReadModel } from './infrastructure/read-model/member.read-model.js';

import { MemberController } from './presentation/http/member.controller.js';

const MEMBER_TRANSACTION_PORT = Symbol.for('sim-pm-api/member/TransactionPort');
const MEMBER_OUTBOX_PORT = Symbol.for('sim-pm-api/member/OutboxPort');

const repositoryProvider: Provider = {
  provide: MemberRepositoryPort,
  useFactory: (handle: PmDbInstanceHandle) =>
    createMemberRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: MEMBER_TRANSACTION_PORT,
  useFactory: (handle: PmDbInstanceHandle): TransactionPort =>
    createMemberTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: MEMBER_OUTBOX_PORT,
  useFactory: (handle: PmDbInstanceHandle): OutboxPort =>
    createMemberOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createMemberLogger(),
};

const readModelProvider: Provider = {
  provide: MemberReadModelQuery,
  useFactory: (repo: MemberRepositoryPort) => new RepositoryMemberReadModel(repo),
  inject: [MemberRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: MemberUseCase,
  useFactory: (
    repo: MemberRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new MemberUseCase(repo, outbox, transaction, logger),
  inject: [MemberRepositoryPort, MEMBER_OUTBOX_PORT, MEMBER_TRANSACTION_PORT, SLICE_LOGGER_PORT],
};

/**
 * Member 슬라이스의 NestJS 모듈.
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
  controllers: [MemberController],
  exports: [MemberRepositoryPort, MemberReadModelQuery, MemberUseCase],
})
export class MemberSliceModule {}
