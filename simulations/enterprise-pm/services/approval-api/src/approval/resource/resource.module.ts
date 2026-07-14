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

import { ResourceRepositoryPort } from './application/ports/resource-repository.port.js';
import { ResourceReadModelQuery } from './application/queries/resource-read-model.query.js';
import { ResourceUseCase } from './application/use-cases/resource.use-case.js';

import { createResourceRepository } from './infrastructure/persistence/resource.repository.js';
import { createResourceTransactionPort } from './infrastructure/transaction/resource.transaction.js';
import { createResourceOutboxPort } from './infrastructure/outbox/resource.outbox.js';
import { createResourceLogger } from './infrastructure/logging/resource.logger.js';
import { RepositoryResourceReadModel } from './infrastructure/read-model/resource.read-model.js';

import { ResourceController } from './presentation/http/resource.controller.js';
import { ResourceDetailBff } from './presentation/bff/resource-detail.bff.js';
import { ResourceDetailController } from './presentation/bff/resource-detail.controller.js';

const RESOURCE_TRANSACTION_PORT = Symbol.for('sim-approval-api/resource/TransactionPort');
const RESOURCE_OUTBOX_PORT = Symbol.for('sim-approval-api/resource/OutboxPort');

const repositoryProvider: Provider = {
  provide: ResourceRepositoryPort,
  useFactory: (handle: ApprovalDbInstanceHandle) =>
    createResourceRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: RESOURCE_TRANSACTION_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): TransactionPort =>
    createResourceTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: RESOURCE_OUTBOX_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): OutboxPort =>
    createResourceOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createResourceLogger(),
};

const readModelProvider: Provider = {
  provide: ResourceReadModelQuery,
  useFactory: (repo: ResourceRepositoryPort) => new RepositoryResourceReadModel(repo),
  inject: [ResourceRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: ResourceUseCase,
  useFactory: (
    repo: ResourceRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new ResourceUseCase(repo, outbox, transaction, logger),
  inject: [
    ResourceRepositoryPort,
    RESOURCE_OUTBOX_PORT,
    RESOURCE_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
  ],
};

const detailBffProvider: Provider = {
  provide: ResourceDetailBff,
  useFactory: (rm: ResourceReadModelQuery, logger: LoggerPort) => new ResourceDetailBff(rm, logger),
  inject: [ResourceReadModelQuery, SLICE_LOGGER_PORT],
};

/**
 * Resource 슬라이스의 NestJS 모듈.
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
  controllers: [ResourceController, ResourceDetailController],
  exports: [ResourceRepositoryPort, ResourceReadModelQuery, ResourceUseCase, ResourceDetailBff],
})
export class ResourceSliceModule {}
