// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from "sim-identifier-grammar";
import {
  VersionDocumentNotFoundException,
  VersionEntity,
} from "../../domain/index.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import type { CreateVersionCommand } from "../commands/create-version.command.js";
import type { VersionLoggerPort } from "../ports/version-logger.port.js";
import type {
  VersionOutboxPort,
  VersionCreatedEventPayload,
} from "../ports/version-outbox.port.js";
import type { VersionRepositoryPort } from "../ports/version-repository.port.js";
import type { VersionTransactionPort } from "../ports/version-transaction.port.js";
import type { DocumentQueryPort } from "../ports/document-query.port.js";

/**
 * Version use-case.
 *
 * - cross-domain coupling: DocumentQueryPort 로 document 존재 검증.
 * - 다음 버전 번호는 latestVersionNumber + 1 (append-only).
 */
export class VersionUseCase {
  constructor(
    private readonly repository: VersionRepositoryPort,
    private readonly outbox: VersionOutboxPort,
    private readonly transaction: VersionTransactionPort,
    private readonly logger: VersionLoggerPort,
    private readonly documentQuery: DocumentQueryPort,
  ) {}

  async create(
    command: CreateVersionCommand,
  ): Promise<{
    readonly documentId: string;
    readonly versionNumber: number;
    readonly status: "CREATED";
  }> {
    const traceId = command.traceId ?? `trace-${command.documentId}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "version",
      useCase: "VersionUseCase.create",
      aggregateId: command.documentId,
      commandName: "CreateVersionCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "version.create.started");

    try {
      // Cross-domain query: document 존재 검증.
      const summary = await this.documentQuery.findSummary(command.documentId);
      if (!summary) {
        throw new VersionDocumentNotFoundException(command.documentId);
      }

      let nextVersion = 0;
      await this.transaction.run("version.create", async (scope) => {
        const latest = await this.repository.latestVersionNumber(command.documentId);
        nextVersion = latest + 1;
        const entity = VersionEntity.create({
          documentId: command.documentId,
          versionNumber: nextVersion,
          contentRef: command.contentRef,
          authorId: command.authorId,
        });
        await this.repository.save(entity, scope);
        const payload: VersionCreatedEventPayload = {
          documentId: command.documentId,
          versionNumber: nextVersion,
          contentRef: command.contentRef,
          authorId: command.authorId,
          occurredAt: new Date().toISOString(),
        };
        const occurredAt = new Date();
        const eventName = "document.version.created";
        const idempotencyEventName = "document.version.created";
        await this.outbox.append(
          {
            aggregateId: command.documentId,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(command.documentId),
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
          eventName: "document.version.created",
          eventVersion: 1,
          outcome: "success",
        },
        "version.create.success",
      );

      return { documentId: command.documentId, versionNumber: nextVersion, status: "CREATED" };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "version.create.failure",
      );
      throw error;
    }
  }
}
