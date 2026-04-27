// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { SubscriptionEntity } from "../../domain/index.js";
import {
  SubscriptionNotFoundException,
  SubscriptionUserUnknownException,
} from "../../domain/subscription.exceptions.js";
import type { CreateSubscriptionCommand } from "../commands/create-subscription.command.js";
import type { SetSubscriptionActiveCommand } from "../commands/set-subscription-active.command.js";
import type { DeleteSubscriptionCommand } from "../commands/delete-subscription.command.js";
import type { SubscriptionLoggerPort } from "../ports/subscription-logger.port.js";
import type {
  SubscriptionOutboxPort,
  SubscriptionActiveChangedEventPayload,
  SubscriptionCreatedEventPayload,
  SubscriptionDeletedEventPayload,
} from "../ports/subscription-outbox.port.js";
import type { SubscriptionRepositoryPort } from "../ports/subscription-repository.port.js";
import type { SubscriptionTransactionPort } from "../ports/subscription-transaction.port.js";
import type { SubscriptionUserQueryPort } from "../ports/user-query.port.js";

export interface SubscriptionResult {
  readonly userId: string;
  readonly eventType: string;
  readonly isActive: boolean;
}

/**
 * Subscription 슬라이스의 use-case.
 *
 * - cross-domain user 존재 확인 (UserQueryPort) → 미존재 시 ConflictError
 * - TransactionPort.run 안에서 repo + outbox 동일 트랜잭션
 * - SliceLogContext 표준 필드 emit
 */
export class SubscriptionUseCase {
  constructor(
    private readonly repository: SubscriptionRepositoryPort,
    private readonly outbox: SubscriptionOutboxPort,
    private readonly transaction: SubscriptionTransactionPort,
    private readonly logger: SubscriptionLoggerPort,
    private readonly userQuery: SubscriptionUserQueryPort,
  ) {}

  async create(command: CreateSubscriptionCommand): Promise<SubscriptionResult> {
    const aggregateId = `${command.userId}:${command.eventType}`;
    const ctxBase = this.makeCtx(
      aggregateId,
      command.traceId,
      command.correlationId,
      "SubscriptionUseCase.create",
      "CreateSubscriptionCommand",
    );
    this.logger.info({ ...ctxBase }, "subscription.create.started");

    try {
      const exists = await this.userQuery.userExists(command.userId);
      if (!exists) {
        throw new SubscriptionUserUnknownException(command.userId);
      }

      const entity = await this.transaction.run("subscription.create", async (scope) => {
        const e = SubscriptionEntity.create({
          userId: command.userId,
          eventType: command.eventType,
          channel: command.channel,
          isActive: command.isActive,
        });
        await this.repository.save(e, scope);
        const payload: SubscriptionCreatedEventPayload = {
          userId: e.userId,
          eventType: e.eventType,
          channel: e.channel,
          isActive: e.isActive,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId,
            eventName: "subscription.created",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
        return e;
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "subscription.created",
          eventVersion: 1,
          outcome: "success",
        },
        "subscription.create.success",
      );

      return { userId: entity.userId, eventType: entity.eventType, isActive: entity.isActive };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "subscription.create.failure",
      );
      throw error;
    }
  }

  async setActive(command: SetSubscriptionActiveCommand): Promise<SubscriptionResult> {
    const aggregateId = `${command.userId}:${command.eventType}`;
    const ctxBase = this.makeCtx(
      aggregateId,
      command.traceId,
      command.correlationId,
      "SubscriptionUseCase.setActive",
      "SetSubscriptionActiveCommand",
    );
    this.logger.info({ ...ctxBase }, "subscription.setActive.started");

    try {
      const entity = await this.transaction.run("subscription.setActive", async (scope) => {
        const cur = await this.repository.findById(command.userId, command.eventType);
        if (!cur) throw new SubscriptionNotFoundException(command.userId, command.eventType);
        const next = cur.setActive(command.isActive);
        await this.repository.save(next, scope);
        const payload: SubscriptionActiveChangedEventPayload = {
          userId: next.userId,
          eventType: next.eventType,
          isActive: next.isActive,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId,
            eventName: "subscription.activeChanged",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
        return next;
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "subscription.activeChanged",
          eventVersion: 1,
          outcome: "success",
        },
        "subscription.setActive.success",
      );

      return { userId: entity.userId, eventType: entity.eventType, isActive: entity.isActive };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "subscription.setActive.failure",
      );
      throw error;
    }
  }

  async delete(command: DeleteSubscriptionCommand): Promise<{ readonly deleted: boolean }> {
    const aggregateId = `${command.userId}:${command.eventType}`;
    const ctxBase = this.makeCtx(
      aggregateId,
      command.traceId,
      command.correlationId,
      "SubscriptionUseCase.delete",
      "DeleteSubscriptionCommand",
    );
    this.logger.info({ ...ctxBase }, "subscription.delete.started");

    try {
      await this.transaction.run("subscription.delete", async (scope) => {
        await this.repository.deleteById(command.userId, command.eventType, scope);
        const payload: SubscriptionDeletedEventPayload = {
          userId: command.userId,
          eventType: command.eventType,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId,
            eventName: "subscription.deleted",
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
          eventName: "subscription.deleted",
          eventVersion: 1,
          outcome: "success",
        },
        "subscription.delete.success",
      );

      return { deleted: true };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "subscription.delete.failure",
      );
      throw error;
    }
  }

  private makeCtx(
    aggregateId: string,
    traceId: string | undefined,
    correlationId: string | undefined,
    useCase: string,
    commandName: string,
  ) {
    const t = traceId ?? `trace-${aggregateId}`;
    return {
      traceId: t,
      correlationId: correlationId ?? t,
      domain: "subscription",
      useCase,
      aggregateId,
      commandName,
    } as const;
  }
}
