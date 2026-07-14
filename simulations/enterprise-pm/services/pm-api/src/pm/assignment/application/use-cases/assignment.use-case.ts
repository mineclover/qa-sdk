// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from 'sim-identifier-grammar';
import { AssignmentEntity } from '../../domain/index.js';
import { toGrammarSafeAggregateId } from '../../../shared/outbox/idempotency-key-source.js';
import type { CreateAssignmentCommand } from '../commands/create-assignment.command.js';
import type { AssignmentLoggerPort } from '../ports/assignment-logger.port.js';
import type {
  AssignmentOutboxPort,
  AssignmentCreatedEventPayload,
} from '../ports/assignment-outbox.port.js';
import type { AssignmentRepositoryPort } from '../ports/assignment-repository.port.js';
import type { AssignmentTransactionPort } from '../ports/assignment-transaction.port.js';

/**
 * Assignment 슬라이스의 단일 use-case.
 *
 * - TransactionPort.run 안에서 repository.save + outbox.append 를 동일 트랜잭션
 *   범위에 묶는다 (Outbox 패턴 — at-least-once 이벤트 보장).
 * - LoggerPort 로 SliceLogContext 표준 필드 (traceId, correlationId, domain,
 *   useCase, aggregateId, commandName, outcome) 를 emit.
 * - 도메인 예외는 catch 한 후 outcome=failure 로 기록 후 rethrow → presentation
 *   계층의 DomainExceptionFilter 가 HTTP 표준 응답으로 변환.
 */
export class AssignmentUseCase {
  constructor(
    private readonly repository: AssignmentRepositoryPort,
    private readonly outbox: AssignmentOutboxPort,
    private readonly transaction: AssignmentTransactionPort,
    private readonly logger: AssignmentLoggerPort,
  ) {}

  async create(
    command: CreateAssignmentCommand,
  ): Promise<{ readonly id: string; readonly status: 'PENDING' }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: 'assignment',
      useCase: 'AssignmentUseCase.create',
      aggregateId: command.id,
      commandName: 'CreateAssignmentCommand',
    } as const;

    this.logger.info({ ...ctxBase }, 'assignment.create.started');

    try {
      await this.transaction.run('assignment.create', async (scope) => {
        const assignment = AssignmentEntity.create(command).assign();
        await this.repository.save(assignment, scope);
        const occurredAt = new Date();
        const payload: AssignmentCreatedEventPayload = {
          id: command.id,
          projectId: command.projectId,
          managerId: command.managerId,
          occurredAt: occurredAt.toISOString(),
        };
        const eventName = 'pm.assignment.created';
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
          eventName: 'pm.assignment.created',
          eventVersion: 1,
          outcome: 'success',
        },
        'assignment.create.success',
      );

      return { id: command.id, status: 'PENDING' };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: 'failure',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          err: error,
        },
        'assignment.create.failure',
      );
      throw error;
    }
  }
}
