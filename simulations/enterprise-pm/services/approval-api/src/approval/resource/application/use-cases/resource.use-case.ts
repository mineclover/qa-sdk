// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from "sim-identifier-grammar";

import { ResourceEntity, ResourceNotFoundException } from "../../domain/index.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import type { CreateResourceCommand } from "../commands/create-resource.command.js";
import type { UpdateResourceStatusCommand } from "../commands/update-resource-status.command.js";
import type { ResourceLoggerPort } from "../ports/resource-logger.port.js";
import type {
  ResourceCreatedEventPayload,
  ResourceOutboxPort,
  ResourceStatusChangedEventPayload,
} from "../ports/resource-outbox.port.js";
import type { ResourceRepositoryPort } from "../ports/resource-repository.port.js";
import type { ResourceTransactionPort } from "../ports/resource-transaction.port.js";

export class ResourceUseCase {
  constructor(
    private readonly repository: ResourceRepositoryPort,
    private readonly outbox: ResourceOutboxPort,
    private readonly transaction: ResourceTransactionPort,
    private readonly logger: ResourceLoggerPort,
  ) {}

  async create(command: CreateResourceCommand): Promise<{ readonly id: string; readonly status: string }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "resource",
      useCase: "ResourceUseCase.create",
      aggregateId: command.id,
      commandName: "CreateResourceCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "resource.create.started");
    try {
      const entity = ResourceEntity.create(command);
      const eventName = "approval.resource.submitted";
      await this.transaction.run("resource.create", async (scope) => {
        await this.repository.save(entity, scope);
        const occurredAt = new Date();
        const payload: ResourceCreatedEventPayload = {
          id: entity.id,
          projectId: command.projectId,
          requesterId: command.requesterId,
          resourceType: command.resourceType,
          occurredAt: occurredAt.toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: entity.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(entity.id),
              eventName,
              occurredAt,
            }),
          },
          scope,
        );
      });
      this.logger.info(
        { ...ctxBase, eventName, eventVersion: 1, outcome: "success" },
        "resource.create.success",
      );
      return { id: entity.id, status: entity.status };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "resource.create.failure",
      );
      throw error;
    }
  }

  async updateStatus(command: UpdateResourceStatusCommand): Promise<{ readonly id: string; readonly status: string }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "resource",
      useCase: "ResourceUseCase.updateStatus",
      aggregateId: command.id,
      commandName: "UpdateResourceStatusCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "resource.updateStatus.started");
    try {
      const eventName = "approval.resource.status-changed";
      const result = await this.transaction.run("resource.updateStatus", async (scope) => {
        const e = await this.repository.findById(command.id);
        if (!e) throw new ResourceNotFoundException(command.id);
        const next = e.changeStatus(command.status);
        await this.repository.save(next, scope);
        const occurredAt = new Date();
        const payload: ResourceStatusChangedEventPayload = {
          id: next.id,
          status: next.status,
          occurredAt: occurredAt.toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: next.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(next.id),
              eventName,
              occurredAt,
            }),
          },
          scope,
        );
        return { id: next.id, status: next.status };
      });
      this.logger.info(
        { ...ctxBase, eventName, eventVersion: 1, outcome: "success" },
        "resource.updateStatus.success",
      );
      return result;
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "resource.updateStatus.failure",
      );
      throw error;
    }
  }
}
