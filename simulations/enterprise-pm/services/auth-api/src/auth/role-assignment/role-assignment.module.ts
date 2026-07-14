// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from '@nestjs/common';
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from '@qa-sdk/sim-domain-slice-kit';
import { BitmapCacheService } from '@qa-sdk/sim-bitmap-cache';

import { AUTH_DB_INSTANCE, type AuthDbInstanceHandle } from '../auth-db.module.js';
import { RoleSliceModule } from '../role/role.module.js';
import { RoleReadModelQuery } from '../role/application/queries/role-read-model.query.js';

import { RoleAssignmentRepositoryPort } from './application/ports/role-assignment-repository.port.js';
import { RoleAssignmentReadModelQuery } from './application/queries/role-assignment-read-model.query.js';
import { RoleAssignmentUseCase } from './application/use-cases/role-assignment.use-case.js';
import { RoleQueryPort } from './application/ports/role-query.port.js';
import { PermissionChangePublisherPort } from './application/ports/permission-change-publisher.port.js';

import { createRoleAssignmentRepository } from './infrastructure/persistence/role-assignment.repository.js';
import { createRoleAssignmentTransactionPort } from './infrastructure/transaction/role-assignment.drizzle-transaction.js';
import { createRoleAssignmentOutboxPort } from './infrastructure/outbox/role-assignment.outbox.js';
import { createRoleAssignmentLogger } from './infrastructure/logging/role-assignment.logger.js';
import { RepositoryRoleAssignmentReadModel } from './infrastructure/read-model/role-assignment.read-model.js';

import { RoleAssignmentController } from './presentation/http/role-assignment.controller.js';

const RA_TRANSACTION_PORT = Symbol.for('sim-auth-api/role-assignment/TransactionPort');
const RA_OUTBOX_PORT = Symbol.for('sim-auth-api/role-assignment/OutboxPort');

const repositoryProvider: Provider = {
  provide: RoleAssignmentRepositoryPort,
  useFactory: (handle: AuthDbInstanceHandle) =>
    createRoleAssignmentRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: RA_TRANSACTION_PORT,
  useFactory: (handle: AuthDbInstanceHandle): TransactionPort =>
    createRoleAssignmentTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: RA_OUTBOX_PORT,
  useFactory: (handle: AuthDbInstanceHandle): OutboxPort =>
    createRoleAssignmentOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [AUTH_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createRoleAssignmentLogger(),
};

const readModelProvider: Provider = {
  provide: RoleAssignmentReadModelQuery,
  useFactory: (repo: RoleAssignmentRepositoryPort) => new RepositoryRoleAssignmentReadModel(repo),
  inject: [RoleAssignmentRepositoryPort],
};

/** RoleQueryPort 어댑터 — 같은 서비스 내 role 슬라이스 read model 위에 얹는다. */
class RoleReadModelQueryAdapter extends RoleQueryPort {
  constructor(private readonly readModel: RoleReadModelQuery) {
    super();
  }
  async roleExists(roleId: string): Promise<boolean> {
    const detail = await this.readModel.findDetail(roleId);
    return detail !== null;
  }
}

const roleQueryProvider: Provider = {
  provide: RoleQueryPort,
  useFactory: (rm: RoleReadModelQuery) => new RoleReadModelQueryAdapter(rm),
  inject: [RoleReadModelQuery],
};

/** PermissionChangePublisherPort 어댑터 — BitmapCacheService.publisher 위에 얹는다. */
class BitmapCachePermissionChangePublisher extends PermissionChangePublisherPort {
  constructor(private readonly bitmapCache?: BitmapCacheService) {
    super();
  }
  async publishUserChange(userId: string, reason: 'permission_change'): Promise<void> {
    if (!this.bitmapCache?.publisher) return;
    await this.bitmapCache.publisher.publishUserChange(userId, reason);
  }
}

const permissionPublisherProvider: Provider = {
  provide: PermissionChangePublisherPort,
  useFactory: (bitmapCache?: BitmapCacheService) =>
    new BitmapCachePermissionChangePublisher(bitmapCache),
  inject: [{ token: BitmapCacheService, optional: true }],
};

const useCaseProvider: Provider = {
  provide: RoleAssignmentUseCase,
  useFactory: (
    repository: RoleAssignmentRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    roleQuery: RoleQueryPort,
    permissionPublisher: PermissionChangePublisherPort,
  ) =>
    new RoleAssignmentUseCase({
      repository,
      outbox,
      transaction,
      logger,
      roleQuery,
      permissionPublisher,
    }),
  inject: [
    RoleAssignmentRepositoryPort,
    RA_OUTBOX_PORT,
    RA_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
    RoleQueryPort,
    PermissionChangePublisherPort,
  ],
};

/**
 * RoleAssignment 슬라이스의 NestJS 모듈.
 *
 * - RoleSliceModule import → RoleReadModelQuery 를 RoleQueryPort 로 어댑팅.
 * - BitmapCacheService 가 부팅된 경우 PermissionChangePublisherPort 로 위임,
 *   미부팅 시 noop publisher (fail-open).
 * - Optional 의존이지만 NestJS provider는 inject 시 token이 존재해야 하므로
 *   필수로 등록 (어댑터가 internal 에서 noop fallback).
 */
@Module({
  imports: [RoleSliceModule],
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    readModelProvider,
    roleQueryProvider,
    permissionPublisherProvider,
    useCaseProvider,
  ],
  controllers: [RoleAssignmentController],
  exports: [RoleAssignmentRepositoryPort, RoleAssignmentReadModelQuery, RoleAssignmentUseCase],
})
export class RoleAssignmentSliceModule {}
