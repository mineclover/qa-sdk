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

import { CommentRepositoryPort } from "./application/ports/comment-repository.port.js";
import { CommentReadModelQuery } from "./application/queries/comment-read-model.query.js";
import { CommentUseCase } from "./application/use-cases/comment.use-case.js";
import { DocumentQueryPort } from "./application/ports/document-query.port.js";

import { createCommentRepository } from "./infrastructure/persistence/comment.repository.js";
import { createCommentTransactionPort } from "./infrastructure/transaction/comment.transaction.js";
import { createCommentOutboxPort } from "./infrastructure/outbox/comment.outbox.js";
import { createCommentLogger } from "./infrastructure/logging/comment.logger.js";
import { RepositoryCommentReadModel } from "./infrastructure/read-model/comment.read-model.js";
import { DocumentReadModelDocumentQueryAdapter } from "./infrastructure/read-model/document-query.adapter.js";

import { DocumentReadModelQuery } from "../document/application/queries/document-read-model.query.js";
import { DocumentSliceModule } from "../document/document.module.js";

import { CommentController } from "./presentation/http/comment.controller.js";

const COMMENT_TRANSACTION_PORT = Symbol.for("sim-document-api/comment/TransactionPort");
const COMMENT_OUTBOX_PORT = Symbol.for("sim-document-api/comment/OutboxPort");

const repositoryProvider: Provider = {
  provide: CommentRepositoryPort,
  useFactory: (handle: DocumentDbInstanceHandle) =>
    createCommentRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: COMMENT_TRANSACTION_PORT,
  useFactory: (handle: DocumentDbInstanceHandle): TransactionPort =>
    createCommentTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: COMMENT_OUTBOX_PORT,
  useFactory: (handle: DocumentDbInstanceHandle): OutboxPort =>
    createCommentOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [DOCUMENT_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createCommentLogger(),
};

const readModelProvider: Provider = {
  provide: CommentReadModelQuery,
  useFactory: (repo: CommentRepositoryPort) => new RepositoryCommentReadModel(repo),
  inject: [CommentRepositoryPort],
};

/**
 * Cross-domain wiring — DocumentReadModelQuery (document slice) 를
 * DocumentQueryPort 로 어댑팅.
 *
 * - infrastructure 계층 한정의 의존 — comment 의 application/domain 은
 *   document slice 의 어떤 것도 import 하지 않는다.
 */
const documentQueryPortProvider: Provider = {
  provide: DocumentQueryPort,
  useFactory: (readModel: DocumentReadModelQuery) =>
    new DocumentReadModelDocumentQueryAdapter(readModel),
  inject: [DocumentReadModelQuery],
};

const useCaseProvider: Provider = {
  provide: CommentUseCase,
  useFactory: (
    repo: CommentRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    documentQuery: DocumentQueryPort,
  ) => new CommentUseCase(repo, outbox, transaction, logger, documentQuery),
  inject: [
    CommentRepositoryPort,
    COMMENT_OUTBOX_PORT,
    COMMENT_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
    DocumentQueryPort,
  ],
};

/**
 * Comment 슬라이스의 NestJS 모듈.
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
  controllers: [CommentController],
  exports: [CommentRepositoryPort, CommentReadModelQuery, CommentUseCase],
})
export class CommentSliceModule {}
