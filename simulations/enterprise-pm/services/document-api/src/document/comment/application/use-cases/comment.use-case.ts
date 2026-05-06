// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from "sim-identifier-grammar";
import { CommentEntity, CommentDocumentNotFoundException } from "../../domain/index.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import type { CreateCommentCommand } from "../commands/create-comment.command.js";
import type { DeleteCommentCommand } from "../commands/delete-comment.command.js";
import type { CommentLoggerPort } from "../ports/comment-logger.port.js";
import type {
  CommentOutboxPort,
  CommentCreatedEventPayload,
  CommentDeletedEventPayload,
} from "../ports/comment-outbox.port.js";
import type { CommentRepositoryPort } from "../ports/comment-repository.port.js";
import type { CommentTransactionPort } from "../ports/comment-transaction.port.js";
import type { DocumentQueryPort } from "../ports/document-query.port.js";

/**
 * Comment use-case.
 *
 * - cross-domain coupling: DocumentQueryPort 를 통해 document 존재 검증.
 *   직접 document slice 의 entity/repository 를 import 하지 않는다.
 */
export class CommentUseCase {
  constructor(
    private readonly repository: CommentRepositoryPort,
    private readonly outbox: CommentOutboxPort,
    private readonly transaction: CommentTransactionPort,
    private readonly logger: CommentLoggerPort,
    private readonly documentQuery: DocumentQueryPort,
  ) {}

  async create(
    command: CreateCommentCommand,
  ): Promise<{ readonly id: string; readonly status: "CREATED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "comment",
      useCase: "CommentUseCase.create",
      aggregateId: command.id,
      commandName: "CreateCommentCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "comment.create.started");

    try {
      // Cross-domain query: document 존재 검증.
      const summary = await this.documentQuery.findSummary(command.documentId);
      if (!summary) {
        throw new CommentDocumentNotFoundException(command.documentId);
      }

      await this.transaction.run("comment.create", async (scope) => {
        const comment = CommentEntity.create({
          id: command.id,
          documentId: command.documentId,
          authorId: command.authorId,
          body: command.body,
          parentCommentId: command.parentCommentId,
        });
        await this.repository.save(comment, scope);
        const payload: CommentCreatedEventPayload = {
          id: command.id,
          documentId: command.documentId,
          authorId: command.authorId,
          body: command.body,
          parentCommentId: command.parentCommentId ?? null,
          occurredAt: new Date().toISOString(),
        };
        const occurredAt = new Date();
        const eventName = "document.comment.created";
        const idempotencyEventName = "document.comment.created";
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(command.id),
              eventName: idempotencyEventName,
              occurredAt,
            }),
          },
          scope,
        );
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "document.comment.created",
          eventVersion: 1,
          outcome: "success",
        },
        "comment.create.success",
      );

      return { id: command.id, status: "CREATED" };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "comment.create.failure",
      );
      throw error;
    }
  }

  async delete(
    command: DeleteCommentCommand,
  ): Promise<{ readonly id: string; readonly status: "DELETED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "comment",
      useCase: "CommentUseCase.delete",
      aggregateId: command.id,
      commandName: "DeleteCommentCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "comment.delete.started");

    try {
      await this.transaction.run("comment.delete", async (scope) => {
        await this.repository.delete(command.id, scope);
        const payload: CommentDeletedEventPayload = {
          id: command.id,
          occurredAt: new Date().toISOString(),
        };
        const occurredAt = new Date();
        const eventName = "document.comment.deleted";
        const idempotencyEventName = "document.comment.deleted";
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(command.id),
              eventName: idempotencyEventName,
              occurredAt,
            }),
          },
          scope,
        );
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "document.comment.deleted",
          eventVersion: 1,
          outcome: "success",
        },
        "comment.delete.success",
      );

      return { id: command.id, status: "DELETED" };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "comment.delete.failure",
      );
      throw error;
    }
  }
}
