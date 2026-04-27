// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { TimeOffEntity, TimeOffNotFoundException } from "../../domain/index.js";
import type { CreateTimeOffCommand } from "../commands/create-timeoff.command.js";
import type { UpdateTimeOffStatusCommand } from "../commands/update-timeoff-status.command.js";
import type { TimeOffLoggerPort } from "../ports/timeoff-logger.port.js";
import type {
  TimeOffCreatedEventPayload,
  TimeOffOutboxPort,
  TimeOffStatusChangedEventPayload,
} from "../ports/timeoff-outbox.port.js";
import type { TimeOffRepositoryPort } from "../ports/timeoff-repository.port.js";
import type { TimeOffTransactionPort } from "../ports/timeoff-transaction.port.js";

export class TimeOffUseCase {
  constructor(
    private readonly repository: TimeOffRepositoryPort,
    private readonly outbox: TimeOffOutboxPort,
    private readonly transaction: TimeOffTransactionPort,
    private readonly logger: TimeOffLoggerPort,
  ) {}

  async create(command: CreateTimeOffCommand): Promise<{ readonly id: string; readonly status: string }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "timeoff",
      useCase: "TimeOffUseCase.create",
      aggregateId: command.id,
      commandName: "CreateTimeOffCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "timeoff.create.started");
    try {
      const entity = TimeOffEntity.create(command);
      await this.transaction.run("timeoff.create", async (scope) => {
        await this.repository.save(entity, scope);
        const payload: TimeOffCreatedEventPayload = {
          id: entity.id,
          requesterId: command.requesterId,
          startDate: command.startDate,
          endDate: command.endDate,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: entity.id,
            eventName: "timeoff.created",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });
      this.logger.info(
        { ...ctxBase, eventName: "timeoff.created", eventVersion: 1, outcome: "success" },
        "timeoff.create.success",
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
        "timeoff.create.failure",
      );
      throw error;
    }
  }

  async updateStatus(command: UpdateTimeOffStatusCommand): Promise<{ readonly id: string; readonly status: string }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "timeoff",
      useCase: "TimeOffUseCase.updateStatus",
      aggregateId: command.id,
      commandName: "UpdateTimeOffStatusCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "timeoff.updateStatus.started");
    try {
      const result = await this.transaction.run("timeoff.updateStatus", async (scope) => {
        const e = await this.repository.findById(command.id);
        if (!e) throw new TimeOffNotFoundException(command.id);
        const next = e.changeStatus(command.status);
        await this.repository.save(next, scope);
        const payload: TimeOffStatusChangedEventPayload = {
          id: next.id,
          status: next.status,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: next.id,
            eventName: "timeoff.status_changed",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
        return { id: next.id, status: next.status };
      });
      this.logger.info(
        { ...ctxBase, eventName: "timeoff.status_changed", eventVersion: 1, outcome: "success" },
        "timeoff.updateStatus.success",
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
        "timeoff.updateStatus.failure",
      );
      throw error;
    }
  }
}
