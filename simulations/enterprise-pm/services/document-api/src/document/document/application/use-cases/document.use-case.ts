// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from "sim-identifier-grammar";
import { DocumentEntity, DocumentNotFoundException } from "../../domain/index.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import type { CreateDocumentCommand } from "../commands/create-document.command.js";
import type { UpdateDocumentCommand } from "../commands/update-document.command.js";
import type { DeleteDocumentCommand } from "../commands/delete-document.command.js";
import type { DocumentLoggerPort } from "../ports/document-logger.port.js";
import type {
  DocumentOutboxPort,
  DocumentCreatedEventPayload,
  DocumentUpdatedEventPayload,
  DocumentDeletedEventPayload,
} from "../ports/document-outbox.port.js";
import type { DocumentRepositoryPort } from "../ports/document-repository.port.js";
import type { DocumentTransactionPort } from "../ports/document-transaction.port.js";

/**
 * Document 슬라이스의 use-case.
 *
 * - TransactionPort.run 안에서 repository.save + outbox.append 를 동일 트랜잭션
 *   범위에 묶는다 (Outbox 패턴 — at-least-once 이벤트 보장).
 * - LoggerPort 로 SliceLogContext 표준 필드 emit.
 * - 도메인 예외는 catch 후 outcome=failure 로 기록 후 rethrow → presentation
 *   계층의 DomainExceptionFilter 가 HTTP 표준 응답으로 변환.
 */
export class DocumentUseCase {
  constructor(
    private readonly repository: DocumentRepositoryPort,
    private readonly outbox: DocumentOutboxPort,
    private readonly transaction: DocumentTransactionPort,
    private readonly logger: DocumentLoggerPort,
  ) {}

  async create(
    command: CreateDocumentCommand,
  ): Promise<{ readonly id: string; readonly status: "CREATED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "document",
      useCase: "DocumentUseCase.create",
      aggregateId: command.id,
      commandName: "CreateDocumentCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "document.create.started");

    try {
      await this.transaction.run("document.create", async (scope) => {
        const document = DocumentEntity.create({
          id: command.id,
          projectId: command.projectId,
          title: command.title,
          ownerId: command.ownerId,
        });
        await this.repository.save(document, scope);
        const payload: DocumentCreatedEventPayload = {
          id: command.id,
          projectId: command.projectId,
          title: command.title,
          ownerId: command.ownerId,
          occurredAt: new Date().toISOString(),
        };
        const occurredAt = new Date();
        const eventName = "document.created";
        const idempotencyEventName = "document.document.created";
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
          eventName: "document.created",
          eventVersion: 1,
          outcome: "success",
        },
        "document.create.success",
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
        "document.create.failure",
      );
      throw error;
    }
  }

  async update(
    command: UpdateDocumentCommand,
  ): Promise<{ readonly id: string; readonly status: "UPDATED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "document",
      useCase: "DocumentUseCase.update",
      aggregateId: command.id,
      commandName: "UpdateDocumentCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "document.update.started");

    try {
      await this.transaction.run("document.update", async (scope) => {
        const existing = await this.repository.findById(command.id);
        if (!existing) {
          throw new DocumentNotFoundException(command.id);
        }
        const updated = existing.update({
          projectId: command.projectId,
          title: command.title,
          ownerId: command.ownerId,
        });
        await this.repository.save(updated, scope);
        const snapshot = updated.toSnapshot();
        const payload: DocumentUpdatedEventPayload = {
          id: snapshot.id,
          projectId: snapshot.projectId,
          title: snapshot.title,
          ownerId: snapshot.ownerId,
          occurredAt: new Date().toISOString(),
        };
        const occurredAt = new Date();
        const eventName = "document.updated";
        const idempotencyEventName = "document.document.updated";
        await this.outbox.append(
          {
            aggregateId: snapshot.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(snapshot.id),
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
          eventName: "document.updated",
          eventVersion: 1,
          outcome: "success",
        },
        "document.update.success",
      );

      return { id: command.id, status: "UPDATED" };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "document.update.failure",
      );
      throw error;
    }
  }

  async delete(
    command: DeleteDocumentCommand,
  ): Promise<{ readonly id: string; readonly status: "DELETED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "document",
      useCase: "DocumentUseCase.delete",
      aggregateId: command.id,
      commandName: "DeleteDocumentCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "document.delete.started");

    try {
      await this.transaction.run("document.delete", async (scope) => {
        await this.repository.delete(command.id, scope);
        const payload: DocumentDeletedEventPayload = {
          id: command.id,
          occurredAt: new Date().toISOString(),
        };
        const occurredAt = new Date();
        const eventName = "document.deleted";
        const idempotencyEventName = "document.document.deleted";
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
          eventName: "document.deleted",
          eventVersion: 1,
          outcome: "success",
        },
        "document.delete.success",
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
        "document.delete.failure",
      );
      throw error;
    }
  }
}
