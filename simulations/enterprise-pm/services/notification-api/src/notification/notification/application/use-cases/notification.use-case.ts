// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from "sim-identifier-grammar";
import { NotificationEntity } from "../../domain/index.js";
import { NotificationNotFoundException } from "../../domain/notification.exceptions.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import type { NotificationStatus } from "../../domain/notification.types.js";
import type { CreateNotificationCommand } from "../commands/create-notification.command.js";
import type { MarkNotificationSentCommand } from "../commands/mark-notification-sent.command.js";
import type { MarkNotificationReadCommand } from "../commands/mark-notification-read.command.js";
import type { MarkNotificationFailedCommand } from "../commands/mark-notification-failed.command.js";
import type { NotificationLoggerPort } from "../ports/notification-logger.port.js";
import type {
  NotificationOutboxPort,
  NotificationDeliveredEventPayload,
  NotificationFailedEventPayload,
  NotificationSentEventPayload,
} from "../ports/notification-outbox.port.js";
import type { NotificationRepositoryPort } from "../ports/notification-repository.port.js";
import type { NotificationTransactionPort } from "../ports/notification-transaction.port.js";

interface NotificationCreatedResult {
  readonly id: string;
  readonly status: NotificationStatus;
}

/**
 * Notification 슬라이스의 use-case.
 *
 * - TransactionPort.run 안에서 repository.save + outbox.append 를 동일 트랜잭션
 *   범위에 묶는다 (Outbox 패턴 — at-least-once 이벤트 보장).
 * - LoggerPort 로 SliceLogContext 표준 필드 (traceId, correlationId, domain,
 *   useCase, aggregateId, commandName, outcome) 를 emit.
 * - 도메인 예외는 catch 한 후 outcome=failure 로 기록 후 rethrow → presentation
 *   계층의 DomainExceptionFilter 가 HTTP 표준 응답으로 변환.
 */
export class NotificationUseCase {
  constructor(
    private readonly repository: NotificationRepositoryPort,
    private readonly outbox: NotificationOutboxPort,
    private readonly transaction: NotificationTransactionPort,
    private readonly logger: NotificationLoggerPort,
  ) {}

  async create(command: CreateNotificationCommand): Promise<NotificationCreatedResult> {
    const ctxBase = this.makeCtx(command, "NotificationUseCase.create", "CreateNotificationCommand");
    this.logger.info({ ...ctxBase }, "notification.create.started");

    try {
      const entity = await this.transaction.run("notification.create", async (scope) => {
        const e = NotificationEntity.create({
          id: command.id,
          recipientUserId: command.recipientUserId,
          type: command.type,
          title: command.title,
          body: command.body,
        });
        await this.repository.save(e, scope);
        return e;
      });

      this.logger.info(
        {
          ...ctxBase,
          outcome: "success",
        },
        "notification.create.success",
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
        "notification.create.failure",
      );
      throw error;
    }
  }

  async markSent(command: MarkNotificationSentCommand): Promise<NotificationCreatedResult> {
    const ctxBase = this.makeCtx(command, "NotificationUseCase.markSent", "MarkNotificationSentCommand");
    this.logger.info({ ...ctxBase }, "notification.markSent.started");

    try {
      const entity = await this.transaction.run("notification.markSent", async (scope) => {
        const cur = await this.repository.findById(command.id);
        if (!cur) throw new NotificationNotFoundException(command.id);
        const next = cur.markSent();
        await this.repository.save(next, scope);
        const occurredAt = new Date();
        const payload: NotificationSentEventPayload = {
          id: next.id,
          recipientUserId: next.recipientUserId,
          type: next.toSnapshot().type,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = "notification.notification.sent";
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
        return next;
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "notification.notification.sent",
          eventVersion: 1,
          outcome: "success",
        },
        "notification.markSent.success",
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
        "notification.markSent.failure",
      );
      throw error;
    }
  }

  async markRead(command: MarkNotificationReadCommand): Promise<NotificationCreatedResult> {
    const ctxBase = this.makeCtx(command, "NotificationUseCase.markRead", "MarkNotificationReadCommand");
    this.logger.info({ ...ctxBase }, "notification.markRead.started");

    try {
      const entity = await this.transaction.run("notification.markRead", async (scope) => {
        const cur = await this.repository.findById(command.id);
        if (!cur) throw new NotificationNotFoundException(command.id);
        const next = cur.markRead();
        await this.repository.save(next, scope);
        const occurredAt = new Date();
        const payload: NotificationDeliveredEventPayload = {
          id: next.id,
          recipientUserId: next.recipientUserId,
          type: next.toSnapshot().type,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = "notification.notification.delivered";
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
        return next;
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "notification.notification.delivered",
          eventVersion: 1,
          outcome: "success",
        },
        "notification.markRead.success",
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
        "notification.markRead.failure",
      );
      throw error;
    }
  }

  async markFailed(command: MarkNotificationFailedCommand): Promise<NotificationCreatedResult> {
    const ctxBase = this.makeCtx(
      command,
      "NotificationUseCase.markFailed",
      "MarkNotificationFailedCommand",
    );
    this.logger.info({ ...ctxBase }, "notification.markFailed.started");

    try {
      const entity = await this.transaction.run("notification.markFailed", async (scope) => {
        const cur = await this.repository.findById(command.id);
        if (!cur) throw new NotificationNotFoundException(command.id);
        const next = cur.markFailed();
        await this.repository.save(next, scope);
        const occurredAt = new Date();
        const payload: NotificationFailedEventPayload = {
          id: next.id,
          recipientUserId: next.recipientUserId,
          type: next.toSnapshot().type,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = "notification.notification.failed";
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
        return next;
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "notification.notification.failed",
          eventVersion: 1,
          outcome: "success",
        },
        "notification.markFailed.success",
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
        "notification.markFailed.failure",
      );
      throw error;
    }
  }

  private makeCtx(
    command: { readonly id: string; readonly traceId?: string; readonly correlationId?: string },
    useCase: string,
    commandName: string,
  ) {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    return {
      traceId,
      correlationId,
      domain: "notification",
      useCase,
      aggregateId: command.id,
      commandName,
    } as const;
  }
}
