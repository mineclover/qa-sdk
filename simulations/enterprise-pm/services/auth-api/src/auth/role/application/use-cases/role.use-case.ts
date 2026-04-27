// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { RoleEntity, DuplicateRoleNameException } from "../../domain/index.js";
import type { CreateRoleCommand } from "../commands/create-role.command.js";
import type { DeleteRoleCommand } from "../commands/delete-role.command.js";
import type { RoleLoggerPort } from "../ports/role-logger.port.js";
import type {
  RoleOutboxPort,
  RoleCreatedEventPayload,
  RoleDeletedEventPayload,
} from "../ports/role-outbox.port.js";
import type { RoleRepositoryPort } from "../ports/role-repository.port.js";
import type { RoleTransactionPort } from "../ports/role-transaction.port.js";

export class RoleUseCase {
  constructor(
    private readonly repository: RoleRepositoryPort,
    private readonly outbox: RoleOutboxPort,
    private readonly transaction: RoleTransactionPort,
    private readonly logger: RoleLoggerPort,
  ) {}

  async create(command: CreateRoleCommand): Promise<{ readonly id: string; readonly status: "ACTIVE" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "role",
      useCase: "RoleUseCase.create",
      aggregateId: command.id,
      commandName: "CreateRoleCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "role.create.started");

    try {
      const existing = await this.repository.findByName(command.name);
      if (existing) {
        throw new DuplicateRoleNameException(command.name);
      }

      await this.transaction.run("role.create", async (scope): Promise<void> => {
        const role = RoleEntity.create({
          id: command.id,
          name: command.name,
          scopeType: command.scopeType,
          defaultMaskHex: command.defaultMaskHex,
        });
        await this.repository.save(role, scope);
        const snap = role.toSnapshot();
        const payload: RoleCreatedEventPayload = {
          id: snap.id,
          name: snap.name,
          scopeType: snap.scopeType,
          defaultMaskHex: snap.defaultMaskHex,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "role.created",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      this.logger.info(
        { ...ctxBase, eventName: "role.created", eventVersion: 1, outcome: "success" },
        "role.create.success",
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
        "role.create.failure",
      );
      throw error;
    }
  }

  async delete(command: DeleteRoleCommand): Promise<{ readonly id: string; readonly status: "DELETED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "role",
      useCase: "RoleUseCase.delete",
      aggregateId: command.id,
      commandName: "DeleteRoleCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "role.delete.started");

    try {
      await this.transaction.run("role.delete", async (scope): Promise<void> => {
        await this.repository.delete(command.id, scope);
        const payload: RoleDeletedEventPayload = {
          id: command.id,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "role.deleted",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      this.logger.info(
        { ...ctxBase, eventName: "role.deleted", eventVersion: 1, outcome: "success" },
        "role.delete.success",
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
        "role.delete.failure",
      );
      throw error;
    }
  }
}
