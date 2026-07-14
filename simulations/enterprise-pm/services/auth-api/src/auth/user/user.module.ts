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

import { UserRepositoryPort } from './application/ports/user-repository.port.js';
import { UserReadModelQuery } from './application/queries/user-read-model.query.js';
import { UserUseCase } from './application/use-cases/user.use-case.js';

import { createUserRepository } from './infrastructure/persistence/user.repository.js';
import { createUserTransactionPort } from './infrastructure/transaction/user.transaction.js';
import { createUserOutboxPort } from './infrastructure/outbox/user.outbox.js';
import { createUserLogger } from './infrastructure/logging/user.logger.js';
import { RepositoryUserReadModel } from './infrastructure/read-model/user.read-model.js';

import { UserController } from './presentation/http/user.controller.js';

const USER_TRANSACTION_PORT = Symbol.for('sim-auth-api/user/TransactionPort');
const USER_OUTBOX_PORT = Symbol.for('sim-auth-api/user/OutboxPort');

const repositoryProvider: Provider = {
  provide: UserRepositoryPort,
  useFactory: (handle: AuthDbInstanceHandle) =>
    createUserRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: USER_TRANSACTION_PORT,
  useFactory: (handle: AuthDbInstanceHandle): TransactionPort =>
    createUserTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: USER_OUTBOX_PORT,
  useFactory: (handle: AuthDbInstanceHandle): OutboxPort =>
    createUserOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createUserLogger(),
};

const readModelProvider: Provider = {
  provide: UserReadModelQuery,
  useFactory: (repo: UserRepositoryPort) => new RepositoryUserReadModel(repo),
  inject: [UserRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: UserUseCase,
  useFactory: (
    repo: UserRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new UserUseCase(repo, outbox, transaction, logger),
  inject: [UserRepositoryPort, USER_OUTBOX_PORT, USER_TRANSACTION_PORT, SLICE_LOGGER_PORT],
};

/**
 * User 슬라이스의 NestJS 모듈.
 *
 * - AuthDbModule (forRoot, global) 이 export 한 AUTH_DB_INSTANCE 를 의존.
 * - SLICE_LOGGER_PORT 를 본 모듈 안에서 직접 provide 하여 다른 슬라이스의
 *   logger 와 충돌하지 않도록 한다.
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
  controllers: [UserController],
  exports: [UserRepositoryPort, UserReadModelQuery, UserUseCase],
})
export class UserSliceModule {}
