// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  DepartmentEntity,
  DepartmentNotFoundException,
  DepartmentCycleException,
} from "../../domain/index.js";
import type { CreateDepartmentCommand } from "../commands/create-department.command.js";
import type { UpdateDepartmentCommand } from "../commands/update-department.command.js";
import type { DeleteDepartmentCommand } from "../commands/delete-department.command.js";
import type { DepartmentLoggerPort } from "../ports/department-logger.port.js";
import type {
  DepartmentOutboxPort,
  DepartmentCreatedEventPayload,
  DepartmentUpdatedEventPayload,
  DepartmentDeletedEventPayload,
} from "../ports/department-outbox.port.js";
import type { DepartmentRepositoryPort } from "../ports/department-repository.port.js";
import type { DepartmentTransactionPort } from "../ports/department-transaction.port.js";

export class DepartmentUseCase {
  constructor(
    private readonly repository: DepartmentRepositoryPort,
    private readonly outbox: DepartmentOutboxPort,
    private readonly transaction: DepartmentTransactionPort,
    private readonly logger: DepartmentLoggerPort,
  ) {}

  async create(command: CreateDepartmentCommand): Promise<{ readonly id: string; readonly status: "ACTIVE" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "department",
      useCase: "DepartmentUseCase.create",
      aggregateId: command.id,
      commandName: "CreateDepartmentCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "department.create.started");
    try {
      await this.transaction.run("department.create", async (scope): Promise<void> => {
        const dept = DepartmentEntity.create({
          id: command.id,
          name: command.name,
          parentId: command.parentId ?? null,
          managerId: command.managerId ?? null,
        });
        await this.repository.save(dept, scope);
        const snap = dept.toSnapshot();
        const payload: DepartmentCreatedEventPayload = {
          id: snap.id,
          name: snap.name,
          parentId: snap.parentId,
          managerId: snap.managerId,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "department.created",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });
      this.logger.info(
        { ...ctxBase, eventName: "department.created", eventVersion: 1, outcome: "success" },
        "department.create.success",
      );
      return { id: command.id, status: "ACTIVE" };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "department.create.failure",
      );
      throw error;
    }
  }

  async update(command: UpdateDepartmentCommand): Promise<{ readonly id: string; readonly status: "ACTIVE" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "department",
      useCase: "DepartmentUseCase.update",
      aggregateId: command.id,
      commandName: "UpdateDepartmentCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "department.update.started");
    try {
      const existing = await this.repository.findById(command.id);
      if (!existing) throw new DepartmentNotFoundException(command.id);

      // Cycle 검사 — patch.parentId 가 자기 자신이거나, 자기 자신의 ancestor 가
      // 후손 사이에 있다면 거부.
      if (command.patch.parentId !== undefined && command.patch.parentId !== null) {
        if (command.patch.parentId === command.id) {
          throw new DepartmentCycleException(command.id, command.patch.parentId);
        }
        const ancestors = await this.repository.resolveChain(command.patch.parentId);
        if (ancestors.some((a) => a.id === command.id)) {
          throw new DepartmentCycleException(command.id, command.patch.parentId);
        }
      }

      await this.transaction.run("department.update", async (scope): Promise<void> => {
        const updated = existing.updateProfile(command.patch);
        await this.repository.save(updated, scope);
        const snap = updated.toSnapshot();
        const payload: DepartmentUpdatedEventPayload = {
          id: snap.id,
          name: snap.name,
          parentId: snap.parentId,
          managerId: snap.managerId,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "department.updated",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });
      this.logger.info(
        { ...ctxBase, eventName: "department.updated", eventVersion: 1, outcome: "success" },
        "department.update.success",
      );
      return { id: command.id, status: "ACTIVE" };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "department.update.failure",
      );
      throw error;
    }
  }

  async delete(command: DeleteDepartmentCommand): Promise<{ readonly id: string; readonly status: "DELETED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "department",
      useCase: "DepartmentUseCase.delete",
      aggregateId: command.id,
      commandName: "DeleteDepartmentCommand",
    } as const;
    this.logger.info({ ...ctxBase }, "department.delete.started");
    try {
      await this.transaction.run("department.delete", async (scope): Promise<void> => {
        await this.repository.delete(command.id, scope);
        const payload: DepartmentDeletedEventPayload = {
          id: command.id,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "department.deleted",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });
      this.logger.info(
        { ...ctxBase, eventName: "department.deleted", eventVersion: 1, outcome: "success" },
        "department.delete.success",
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
        "department.delete.failure",
      );
      throw error;
    }
  }
}
