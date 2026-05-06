// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from "sim-identifier-grammar";
import { MemberEntity } from "../../domain/index.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import type {
  AddMemberCommand,
  RemoveMemberCommand,
} from "../commands/add-member.command.js";
import type { MemberLoggerPort } from "../ports/member-logger.port.js";
import type {
  MemberOutboxPort,
  MemberAddedEventPayload,
  MemberRemovedEventPayload,
} from "../ports/member-outbox.port.js";
import type { MemberRepositoryPort } from "../ports/member-repository.port.js";
import type { MemberTransactionPort } from "../ports/member-transaction.port.js";

/**
 * Member 슬라이스의 use-case.
 *
 * - TransactionPort.run 안에서 repository.save + outbox.append 동일 트랜잭션.
 * - LoggerPort 로 SliceLogContext 표준 emit.
 */
export class MemberUseCase {
  constructor(
    private readonly repository: MemberRepositoryPort,
    private readonly outbox: MemberOutboxPort,
    private readonly transaction: MemberTransactionPort,
    private readonly logger: MemberLoggerPort,
  ) {}

  async add(command: AddMemberCommand): Promise<{
    readonly projectId: string;
    readonly userId: string;
    readonly role: string;
    readonly joinedAt: string;
  }> {
    const aggregateId = `${command.projectId}:${command.userId}`;
    const traceId = command.traceId ?? `trace-${aggregateId}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "member",
      useCase: "MemberUseCase.add",
      aggregateId,
      commandName: "AddMemberCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "member.add.started");

    try {
      let snapshotResult: ReturnType<MemberEntity["toSnapshot"]>;
      await this.transaction.run("member.add", async (scope) => {
        const member = MemberEntity.create({
          projectId: command.projectId,
          userId: command.userId,
          role: command.role,
        });
        await this.repository.save(member, scope);
        snapshotResult = member.toSnapshot();
        const occurredAt = new Date();
        const payload: MemberAddedEventPayload = {
          projectId: snapshotResult.projectId,
          userId: snapshotResult.userId,
          role: snapshotResult.role,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = "pm.member.added";
        await this.outbox.append(
          {
            aggregateId,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(aggregateId),
              eventName,
              occurredAt,
            }),
          },
          scope,
        );
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "pm.member.added",
          eventVersion: 1,
          outcome: "success",
        },
        "member.add.success",
      );

      return snapshotResult!;
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "member.add.failure",
      );
      throw error;
    }
  }

  async remove(command: RemoveMemberCommand): Promise<void> {
    const aggregateId = `${command.projectId}:${command.userId}`;
    const traceId = command.traceId ?? `trace-${aggregateId}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "member",
      useCase: "MemberUseCase.remove",
      aggregateId,
      commandName: "RemoveMemberCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "member.remove.started");

    try {
      await this.transaction.run("member.remove", async (scope) => {
        await this.repository.delete(command.projectId, command.userId, scope);
        const occurredAt = new Date();
        const payload: MemberRemovedEventPayload = {
          projectId: command.projectId,
          userId: command.userId,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = "pm.member.removed";
        await this.outbox.append(
          {
            aggregateId,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(aggregateId),
              eventName,
              occurredAt,
            }),
          },
          scope,
        );
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName: "pm.member.removed",
          eventVersion: 1,
          outcome: "success",
        },
        "member.remove.success",
      );
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "member.remove.failure",
      );
      throw error;
    }
  }
}
