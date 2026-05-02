// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from "sim-identifier-grammar";

import { BudgetEntity } from "../../domain/index.js";
import { BudgetNotFoundException } from "../../domain/budget.exceptions.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import type { CreateBudgetCommand } from "../commands/create-budget.command.js";
import type { DecideBudgetCommand } from "../commands/decide-budget.command.js";
import type { BudgetLoggerPort } from "../ports/budget-logger.port.js";
import type {
  BudgetCreatedEventPayload,
  BudgetDecidedEventPayload,
  BudgetOutboxPort,
} from "../ports/budget-outbox.port.js";
import type { BudgetRepositoryPort } from "../ports/budget-repository.port.js";
import type { BudgetTransactionPort } from "../ports/budget-transaction.port.js";
import type { BudgetPolicyLifecyclePort } from "../ports/access-check.port.js";

/**
 * Budget 슬라이스의 use-case.
 *
 * - TransactionPort.run 안에서 repository.save + outbox.append 를 동일 트랜잭션
 *   범위에 묶는다 (Outbox 패턴).
 * - 도메인 entity 의 transition 메서드를 호출한다 (legacy budget-state.ts 의 절차적
 *   transition 함수를 entity 가 흡수했음).
 * - Pass 2 policy lifecycle (UNREGISTERED → REGISTERED) 은 BudgetPolicyLifecyclePort
 *   으로 위임 — auth bounded context 가 결정. fail-open: lifecycle 실패는 logger.warn
 *   으로 기록 후 swallow (legacy BudgetService.create 와 동일 컨벤션).
 */
export class BudgetUseCase {
  constructor(
    private readonly repository: BudgetRepositoryPort,
    private readonly outbox: BudgetOutboxPort,
    private readonly transaction: BudgetTransactionPort,
    private readonly logger: BudgetLoggerPort,
    private readonly policyLifecycle?: BudgetPolicyLifecyclePort,
  ) {}

  async create(command: CreateBudgetCommand): Promise<{ readonly id: string; readonly status: string; readonly totalStages: number }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "budget",
      useCase: "BudgetUseCase.create",
      aggregateId: command.id,
      commandName: "CreateBudgetCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "budget.create.started");

    try {
      const entity = BudgetEntity.create({
        id: command.id,
        projectId: command.projectId,
        projectDepartmentId: command.projectDepartmentId,
        amount: command.amount,
        requesterId: command.requesterId,
      });

      await this.transaction.run("budget.create", async (scope) => {
        await this.repository.save(entity, scope);
        const occurredAt = new Date();
        const eventName = "approval.budget.submitted";
        const payload: BudgetCreatedEventPayload = {
          id: entity.id,
          projectId: command.projectId,
          projectDepartmentId: command.projectDepartmentId,
          amount: command.amount,
          requesterId: command.requesterId,
          totalStages: entity.totalStages,
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

      // Pass 2 lifecycle — fail-open. 미주입 시 skip (legacy 와 동일).
      if (this.policyLifecycle) {
        try {
          await this.policyLifecycle.onCreated({
            requestId: entity.id,
            requesterId: command.requesterId,
          });
        } catch (err) {
          this.logger.warn(
            {
              ...ctxBase,
              aggregateId: entity.id,
              outcome: "failure",
              errorCode: err instanceof Error ? err.name : "POLICY_LIFECYCLE_FAILED",
            },
            "budget.create.policy_lifecycle_failed",
          );
        }
      }

      this.logger.info(
        {
          ...ctxBase,
          eventName: "approval.budget.submitted",
          eventVersion: 1,
          outcome: "success",
        },
        "budget.create.success",
      );

      return { id: entity.id, status: entity.status, totalStages: entity.totalStages };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "budget.create.failure",
      );
      throw error;
    }
  }

  async submit(id: string, traceId?: string, correlationId?: string): Promise<{ readonly id: string; readonly status: string }> {
    return this.transition({
      id,
      action: "submit",
      traceId,
      correlationId,
      apply: (entity) => entity.submit(),
    });
  }

  async startReview(id: string, traceId?: string, correlationId?: string): Promise<{ readonly id: string; readonly status: string }> {
    return this.transition({
      id,
      action: "start-review",
      traceId,
      correlationId,
      apply: (entity) => entity.startReview(),
    });
  }

  async decide(command: DecideBudgetCommand): Promise<{ readonly id: string; readonly status: string; readonly currentStage: number }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "budget",
      useCase: "BudgetUseCase.decide",
      aggregateId: command.id,
      commandName: "DecideBudgetCommand",
    } as const;

    // grammar #12 — verb 는 decision 결과(approved|rejected)로 정확화.
    const eventName: "approval.budget.approved" | "approval.budget.rejected" =
      command.decision === "approved"
        ? "approval.budget.approved"
        : "approval.budget.rejected";

    this.logger.info({ ...ctxBase }, `budget.decide.started.${command.decision}`);

    try {
      const result = await this.transaction.run("budget.decide", async (scope) => {
        const entity = await this.repository.findById(command.id);
        if (!entity) throw new BudgetNotFoundException(command.id);
        const stageBefore = entity.currentStage;
        const next = entity.decide(command.decision);
        await this.repository.save(next, scope);
        const occurredAt = new Date();
        const payload: BudgetDecidedEventPayload = {
          id: next.id,
          approverId: command.approverId,
          decision: command.decision,
          stage: stageBefore,
          nextStatus: next.status,
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
        return { id: next.id, status: next.status, currentStage: next.currentStage };
      });

      this.logger.info(
        {
          ...ctxBase,
          eventName,
          eventVersion: 1,
          outcome: "success",
        },
        "budget.decide.success",
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
        "budget.decide.failure",
      );
      throw error;
    }
  }

  private async transition(args: {
    readonly id: string;
    readonly action: string;
    readonly traceId?: string;
    readonly correlationId?: string;
    readonly apply: (entity: BudgetEntity) => BudgetEntity;
  }): Promise<{ readonly id: string; readonly status: string }> {
    const traceId = args.traceId ?? `trace-${args.id}`;
    const correlationId = args.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "budget",
      useCase: `BudgetUseCase.${args.action}`,
      aggregateId: args.id,
      commandName: `${args.action}-budget`,
    } as const;

    this.logger.info({ ...ctxBase }, `budget.${args.action}.started`);

    try {
      const result = await this.transaction.run(`budget.${args.action}`, async (scope) => {
        const entity = await this.repository.findById(args.id);
        if (!entity) throw new BudgetNotFoundException(args.id);
        const next = args.apply(entity);
        await this.repository.save(next, scope);
        return { id: next.id, status: next.status };
      });

      this.logger.info({ ...ctxBase, outcome: "success" }, `budget.${args.action}.success`);
      return result;
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        `budget.${args.action}.failure`,
      );
      throw error;
    }
  }
}
