// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { UserEntity, DuplicateUserEmailException, UserNotFoundException } from "../../domain/index.js";
import type { CreateUserCommand } from "../commands/create-user.command.js";
import type { UpdateUserCommand } from "../commands/update-user.command.js";
import type { DeleteUserCommand } from "../commands/delete-user.command.js";
import type { UserLoggerPort } from "../ports/user-logger.port.js";
import type {
  UserOutboxPort,
  UserCreatedEventPayload,
  UserUpdatedEventPayload,
  UserDeletedEventPayload,
} from "../ports/user-outbox.port.js";
import type { UserRepositoryPort } from "../ports/user-repository.port.js";
import type { UserTransactionPort } from "../ports/user-transaction.port.js";

/**
 * User 슬라이스의 use-case.
 *
 * - TransactionPort.run 안에서 repository.save + outbox.append 를 동일 트랜잭션
 *   범위에 묶는다 (Outbox 패턴).
 * - LoggerPort 로 SliceLogContext 표준 필드 emit.
 * - 도메인 예외는 catch 한 후 outcome=failure 로 기록 후 rethrow → presentation
 *   계층의 DomainExceptionFilter 가 HTTP 표준 응답으로 변환.
 */
export class UserUseCase {
  constructor(
    private readonly repository: UserRepositoryPort,
    private readonly outbox: UserOutboxPort,
    private readonly transaction: UserTransactionPort,
    private readonly logger: UserLoggerPort,
  ) {}

  async create(command: CreateUserCommand): Promise<{ readonly id: string; readonly status: "ACTIVE" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "user",
      useCase: "UserUseCase.create",
      aggregateId: command.id,
      commandName: "CreateUserCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "user.create.started");

    try {
      // 사전 중복 검사 — repository (write-side) 직접 사용 (read model 미아직 sync).
      const existing = await this.repository.findByEmail(command.email);
      if (existing) {
        throw new DuplicateUserEmailException(command.email);
      }

      await this.transaction.run("user.create", async (scope): Promise<void> => {
        const user = UserEntity.create({
          id: command.id,
          email: command.email,
          displayName: command.displayName,
          departmentId: command.departmentId ?? null,
          primaryRoleId: command.primaryRoleId ?? null,
        });
        await this.repository.save(user, scope);
        const payload: UserCreatedEventPayload = {
          id: user.toSnapshot().id,
          email: user.toSnapshot().email,
          displayName: user.toSnapshot().displayName,
          departmentId: user.toSnapshot().departmentId,
          primaryRoleId: user.toSnapshot().primaryRoleId,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "user.created",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "user.created",
          eventVersion: 1,
          outcome: "success",
        },
        "user.create.success",
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
        "user.create.failure",
      );
      throw error;
    }
  }

  async update(command: UpdateUserCommand): Promise<{ readonly id: string; readonly status: "ACTIVE" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "user",
      useCase: "UserUseCase.update",
      aggregateId: command.id,
      commandName: "UpdateUserCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "user.update.started");

    try {
      const existing = await this.repository.findById(command.id);
      if (!existing) {
        throw new UserNotFoundException(command.id);
      }

      await this.transaction.run("user.update", async (scope) => {
        const updated = existing.updateProfile(command.patch);
        await this.repository.save(updated, scope);
        const snap = updated.toSnapshot();
        const payload: UserUpdatedEventPayload = {
          id: snap.id,
          email: snap.email,
          displayName: snap.displayName,
          departmentId: snap.departmentId,
          primaryRoleId: snap.primaryRoleId,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "user.updated",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      this.logger.info(
        { ...ctxBase, eventName: "user.updated", eventVersion: 1, outcome: "success" },
        "user.update.success",
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
        "user.update.failure",
      );
      throw error;
    }
  }

  async delete(command: DeleteUserCommand): Promise<{ readonly id: string; readonly status: "DELETED" }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "user",
      useCase: "UserUseCase.delete",
      aggregateId: command.id,
      commandName: "DeleteUserCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "user.delete.started");

    try {
      await this.transaction.run("user.delete", async (scope) => {
        await this.repository.delete(command.id, scope);
        const payload: UserDeletedEventPayload = {
          id: command.id,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "user.deleted",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      this.logger.info(
        { ...ctxBase, eventName: "user.deleted", eventVersion: 1, outcome: "success" },
        "user.delete.success",
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
        "user.delete.failure",
      );
      throw error;
    }
  }
}
