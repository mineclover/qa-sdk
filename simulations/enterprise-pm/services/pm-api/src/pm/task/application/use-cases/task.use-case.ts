// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from 'sim-identifier-grammar';
import { TaskEntity, TaskNotFoundException } from '../../domain/index.js';
import { toGrammarSafeAggregateId } from '../../../shared/outbox/idempotency-key-source.js';
import type {
  CreateTaskCommand,
  DeleteTaskCommand,
  UpdateTaskCommand,
} from '../commands/create-task.command.js';
import type { TaskLoggerPort } from '../ports/task-logger.port.js';
import type {
  TaskOutboxPort,
  TaskCreatedEventPayload,
  TaskUpdatedEventPayload,
  TaskDeletedEventPayload,
} from '../ports/task-outbox.port.js';
import type { TaskRepositoryPort } from '../ports/task-repository.port.js';
import type { TaskTransactionPort } from '../ports/task-transaction.port.js';

/**
 * Task 슬라이스의 use-case.
 *
 * - TransactionPort.run 안에서 repository.save + outbox.append 를 동일 트랜잭션
 *   범위에 묶는다 (Outbox 패턴).
 * - LoggerPort 로 SliceLogContext 표준 필드를 emit.
 * - 도메인 예외는 catch 후 outcome=failure 로 기록 후 rethrow.
 */
export class TaskUseCase {
  constructor(
    private readonly repository: TaskRepositoryPort,
    private readonly outbox: TaskOutboxPort,
    private readonly transaction: TaskTransactionPort,
    private readonly logger: TaskLoggerPort,
  ) {}

  async create(command: CreateTaskCommand): Promise<{
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly status: string;
    readonly parentTaskId: string | null;
    readonly assigneeId: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: 'task',
      useCase: 'TaskUseCase.create',
      aggregateId: command.id,
      commandName: 'CreateTaskCommand',
    } as const;

    this.logger.info({ ...ctxBase }, 'task.create.started');

    try {
      let snapshotResult: ReturnType<TaskEntity['toSnapshot']>;
      await this.transaction.run('task.create', async (scope) => {
        const task = TaskEntity.create({
          id: command.id,
          projectId: command.projectId,
          title: command.title,
          assigneeId: command.assigneeId ?? null,
          status: command.status,
          parentTaskId: command.parentTaskId ?? null,
        });
        await this.repository.save(task, scope);
        snapshotResult = task.toSnapshot();
        const occurredAt = new Date();
        const payload: TaskCreatedEventPayload = {
          id: command.id,
          projectId: command.projectId,
          title: command.title,
          status: snapshotResult.status,
          parentTaskId: snapshotResult.parentTaskId,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = 'pm.task.created';
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(command.id),
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
          eventName: 'pm.task.created',
          eventVersion: 1,
          outcome: 'success',
        },
        'task.create.success',
      );

      return snapshotResult!;
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: 'failure',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          err: error,
        },
        'task.create.failure',
      );
      throw error;
    }
  }

  async update(command: UpdateTaskCommand): Promise<{
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly status: string;
    readonly parentTaskId: string | null;
    readonly assigneeId: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: 'task',
      useCase: 'TaskUseCase.update',
      aggregateId: command.id,
      commandName: 'UpdateTaskCommand',
    } as const;

    this.logger.info({ ...ctxBase }, 'task.update.started');

    try {
      let snapshotResult: ReturnType<TaskEntity['toSnapshot']>;
      await this.transaction.run('task.update', async (scope) => {
        const cur = await this.repository.findById(command.id);
        if (!cur) throw new TaskNotFoundException(command.id);
        const next = cur.applyPatch(command.patch);
        await this.repository.save(next, scope);
        snapshotResult = next.toSnapshot();
        const occurredAt = new Date();
        const payload: TaskUpdatedEventPayload = {
          id: command.id,
          projectId: snapshotResult.projectId,
          status: snapshotResult.status,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = 'pm.task.updated';
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(command.id),
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
          eventName: 'pm.task.updated',
          eventVersion: 1,
          outcome: 'success',
        },
        'task.update.success',
      );

      return snapshotResult!;
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: 'failure',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          err: error,
        },
        'task.update.failure',
      );
      throw error;
    }
  }

  async delete(command: DeleteTaskCommand): Promise<void> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: 'task',
      useCase: 'TaskUseCase.delete',
      aggregateId: command.id,
      commandName: 'DeleteTaskCommand',
    } as const;

    this.logger.info({ ...ctxBase }, 'task.delete.started');

    try {
      await this.transaction.run('task.delete', async (scope) => {
        await this.repository.delete(command.id, scope);
        const occurredAt = new Date();
        const payload: TaskDeletedEventPayload = {
          id: command.id,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = 'pm.task.deleted';
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(command.id),
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
          eventName: 'pm.task.deleted',
          eventVersion: 1,
          outcome: 'success',
        },
        'task.delete.success',
      );
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: 'failure',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          err: error,
        },
        'task.delete.failure',
      );
      throw error;
    }
  }
}
