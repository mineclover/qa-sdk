// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { ExpenseEntity, ExpenseNotFoundException } from "../../domain/index.js";
import type { CreateExpenseCommand } from "../commands/create-expense.command.js";
import type { UpdateExpenseStatusCommand } from "../commands/update-expense-status.command.js";
import type { ExpenseLoggerPort } from "../ports/expense-logger.port.js";
import type {
  ExpenseCreatedEventPayload,
  ExpenseOutboxPort,
  ExpenseStatusChangedEventPayload,
} from "../ports/expense-outbox.port.js";
import type { ExpenseRepositoryPort } from "../ports/expense-repository.port.js";
import type { ExpenseTransactionPort } from "../ports/expense-transaction.port.js";

export class ExpenseUseCase {
  constructor(
    private readonly repository: ExpenseRepositoryPort,
    private readonly outbox: ExpenseOutboxPort,
    private readonly transaction: ExpenseTransactionPort,
    private readonly logger: ExpenseLoggerPort,
  ) {}

  async create(command: CreateExpenseCommand): Promise<{ readonly id: string; readonly status: string }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "expense",
      useCase: "ExpenseUseCase.create",
      aggregateId: command.id,
      commandName: "CreateExpenseCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "expense.create.started");
    try {
      const entity = ExpenseEntity.create(command);
      await this.transaction.run("expense.create", async (scope) => {
        await this.repository.save(entity, scope);
        const payload: ExpenseCreatedEventPayload = {
          id: entity.id,
          requesterId: command.requesterId,
          amount: command.amount,
          category: command.category,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: entity.id,
            eventName: "expense.created",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });
      this.logger.info(
        { ...ctxBase, eventName: "expense.created", eventVersion: 1, outcome: "success" },
        "expense.create.success",
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
        "expense.create.failure",
      );
      throw error;
    }
  }

  async updateStatus(command: UpdateExpenseStatusCommand): Promise<{ readonly id: string; readonly status: string }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "expense",
      useCase: "ExpenseUseCase.updateStatus",
      aggregateId: command.id,
      commandName: "UpdateExpenseStatusCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "expense.updateStatus.started");
    try {
      const result = await this.transaction.run("expense.updateStatus", async (scope) => {
        const entity = await this.repository.findById(command.id);
        if (!entity) throw new ExpenseNotFoundException(command.id);
        const next = entity.changeStatus(command.status);
        await this.repository.save(next, scope);
        const payload: ExpenseStatusChangedEventPayload = {
          id: next.id,
          status: next.status,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: next.id,
            eventName: "expense.status_changed",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
        return { id: next.id, status: next.status };
      });
      this.logger.info(
        { ...ctxBase, eventName: "expense.status_changed", eventVersion: 1, outcome: "success" },
        "expense.updateStatus.success",
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
        "expense.updateStatus.failure",
      );
      throw error;
    }
  }
}
