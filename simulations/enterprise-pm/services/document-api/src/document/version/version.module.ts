// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from '@nestjs/common';
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from '@qa-sdk/sim-domain-slice-kit';

import { DOCUMENT_DB_INSTANCE, type DocumentDbInstanceHandle } from '../document-db.module.js';

import { VersionRepositoryPort } from './application/ports/version-repository.port.js';
import { VersionReadModelQuery } from './application/queries/version-read-model.query.js';
import { VersionUseCase } from './application/use-cases/version.use-case.js';
import { DocumentQueryPort } from './application/ports/document-query.port.js';

import { createVersionRepository } from './infrastructure/persistence/version.repository.js';
import { createVersionTransactionPort } from './infrastructure/transaction/version.transaction.js';
import { createVersionOutboxPort } from './infrastructure/outbox/version.outbox.js';
import { createVersionLogger } from './infrastructure/logging/version.logger.js';
import { RepositoryVersionReadModel } from './infrastructure/read-model/version.read-model.js';
import { DocumentReadModelDocumentQueryAdapter } from './infrastructure/read-model/document-query.adapter.js';

import { DocumentReadModelQuery } from '../document/application/queries/document-read-model.query.js';
import { DocumentSliceModule } from '../document/document.module.js';

import { VersionController } from './presentation/http/version.controller.js';

const VERSION_TRANSACTION_PORT = Symbol.for('sim-document-api/version/TransactionPort');
const VERSION_OUTBOX_PORT = Symbol.for('sim-document-api/version/OutboxPort');

const repositoryProvider: Provider = {
  provide: VersionRepositoryPort,
  useFactory: (handle: DocumentDbInstanceHandle) =>
    createVersionRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: VERSION_TRANSACTION_PORT,
  useFactory: (handle: DocumentDbInstanceHandle): TransactionPort =>
    createVersionTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: VERSION_OUTBOX_PORT,
  useFactory: (handle: DocumentDbInstanceHandle): OutboxPort =>
    createVersionOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createVersionLogger(),
};

const readModelProvider: Provider = {
  provide: VersionReadModelQuery,
  useFactory: (repo: VersionRepositoryPort) => new RepositoryVersionReadModel(repo),
  inject: [VersionRepositoryPort],
};

/**
 * Cross-domain wiring — DocumentReadModelQuery (document slice) 를
 * DocumentQueryPort 로 어댑팅.
 */
const documentQueryPortProvider: Provider = {
  provide: DocumentQueryPort,
  useFactory: (readModel: DocumentReadModelQuery) =>
    new DocumentReadModelDocumentQueryAdapter(readModel),
  inject: [DocumentReadModelQuery],
};

const useCaseProvider: Provider = {
  provide: VersionUseCase,
  useFactory: (
    repo: VersionRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    documentQuery: DocumentQueryPort,
  ) => new VersionUseCase(repo, outbox, transaction, logger, documentQuery),
  inject: [
    VersionRepositoryPort,
    VERSION_OUTBOX_PORT,
    VERSION_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
    DocumentQueryPort,
  ],
};

/**
 * Version 슬라이스의 NestJS 모듈.
 *
 * - DocumentDbModule (forRoot, global) 의 DOCUMENT_DB_INSTANCE 의존.
 * - DocumentSliceModule 의 DocumentReadModelQuery 를 DocumentQueryPort 로 어댑팅 (cross-domain).
 * - SLICE_LOGGER_PORT 는 본 모듈 내부에서 직접 provide.
 */
@Module({
  imports: [DocumentSliceModule],
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    readModelProvider,
    documentQueryPortProvider,
    useCaseProvider,
  ],
  controllers: [VersionController],
  exports: [VersionRepositoryPort, VersionReadModelQuery, VersionUseCase],
})
export class VersionSliceModule {}
