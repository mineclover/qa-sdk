import { AssignmentEntity } from '../../domain/index.js';
import type { CreateAssignmentCommand } from '../commands/create-assignment.command.js';
import type { AssignmentLoggerPort } from '../ports/assignment-logger.port.js';
import type { AssignmentOutboxPort } from '../ports/assignment-outbox.port.js';
import type { AssignmentRepositoryPort } from '../ports/assignment-repository.port.js';
import type { AssignmentTransactionPort } from '../ports/assignment-transaction.port.js';

export class AssignmentUseCase {
  constructor(
    private readonly repository: AssignmentRepositoryPort,
    private readonly outbox: AssignmentOutboxPort,
    private readonly transaction: AssignmentTransactionPort,
    private readonly logger: AssignmentLoggerPort,
  ) {}

  async create(command: CreateAssignmentCommand): Promise<void> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    await this.logger.record({
      traceId,
      correlationId,
      domain: 'assignment',
      useCase: 'AssignmentUseCase.create',
      aggregateId: command.id,
      commandName: 'CreateAssignmentCommand',
      outcome: 'started',
    });

    try {
      await this.transaction.run('assignment.create', async (scope) => {
        const assignment = AssignmentEntity.create(command).assign();
        await this.repository.save(assignment, scope);
        await this.outbox.appendCreated(
          {
            id: command.id,
            assigneeId: command.assigneeId,
            occurredAt: new Date().toISOString(),
          },
          scope,
        );
      });

      await this.logger.record({
        traceId,
        correlationId,
        domain: 'assignment',
        useCase: 'AssignmentUseCase.create',
        aggregateId: command.id,
        commandName: 'CreateAssignmentCommand',
        eventName: 'assignment.created',
        eventVersion: 'v1',
        outcome: 'success',
      });
    } catch (error) {
      await this.logger.record({
        traceId,
        correlationId,
        domain: 'assignment',
        useCase: 'AssignmentUseCase.create',
        aggregateId: command.id,
        commandName: 'CreateAssignmentCommand',
        outcome: 'failure',
        errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      });
      throw error;
    }
  }
}
