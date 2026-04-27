// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from "@qa-sdk/sim-domain-slice-kit";

import {
  DOCUMENT_DB_INSTANCE,
  type DocumentDbInstanceHandle,
} from "../document-db.module.js";

import { DocumentRepositoryPort } from "./application/ports/document-repository.port.js";
import { DocumentReadModelQuery } from "./application/queries/document-read-model.query.js";
import { DocumentUseCase } from "./application/use-cases/document.use-case.js";

import { createDocumentSliceRepository } from "./infrastructure/persistence/document.repository.js";
import { createDocumentTransactionPort } from "./infrastructure/transaction/document.transaction.js";
import { createDocumentOutboxPort } from "./infrastructure/outbox/document.outbox.js";
import { createDocumentLogger } from "./infrastructure/logging/document.logger.js";
import { RepositoryDocumentReadModel } from "./infrastructure/read-model/document.read-model.js";

import { DocumentController } from "./presentation/http/document.controller.js";

const DOCUMENT_TRANSACTION_PORT = Symbol.for("sim-document-api/document/TransactionPort");
const DOCUMENT_OUTBOX_PORT = Symbol.for("sim-document-api/document/OutboxPort");

const repositoryProvider: Provider = {
  provide: DocumentRepositoryPort,
  useFactory: (handle: DocumentDbInstanceHandle) =>
    createDocumentSliceRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: DOCUMENT_TRANSACTION_PORT,
  useFactory: (handle: DocumentDbInstanceHandle): TransactionPort =>
    createDocumentTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: DOCUMENT_OUTBOX_PORT,
  useFactory: (handle: DocumentDbInstanceHandle): OutboxPort =>
    createDocumentOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createDocumentLogger(),
};

const readModelProvider: Provider = {
  provide: DocumentReadModelQuery,
  useFactory: (repo: DocumentRepositoryPort) => new RepositoryDocumentReadModel(repo),
  inject: [DocumentRepositoryPort],
};

const useCaseProvider: Provider = {
  provide: DocumentUseCase,
  useFactory: (
    repo: DocumentRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) => new DocumentUseCase(repo, outbox, transaction, logger),
  inject: [
    DocumentRepositoryPort,
    DOCUMENT_OUTBOX_PORT,
    DOCUMENT_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
  ],
};

/**
 * Document 슬라이스의 NestJS 모듈.
 *
 * - DocumentDbModule (forRoot, global) 의 DOCUMENT_DB_INSTANCE 의존.
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
  controllers: [DocumentController],
  exports: [DocumentRepositoryPort, DocumentReadModelQuery, DocumentUseCase],
})
export class DocumentSliceModule {}
