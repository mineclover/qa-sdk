import {
  AssignmentNotBillableException,
  AssignmentPreconditionNotReadyException,
  BillingEntity,
} from '../../domain/index.js';
import type { CreateBillingCommand } from '../commands/create-billing.command.js';
import type { AssignmentStateQueryPort } from '../ports/assignment-state.query-port.js';
import type { BillingLoggerPort } from '../ports/billing-logger.port.js';
import type { BillingRepositoryPort } from '../ports/billing-repository.port.js';
import type { BillingTransactionPort } from '../ports/billing-transaction.port.js';

export class CreateBillingUseCase {
  constructor(
    private readonly assignmentState: AssignmentStateQueryPort,
    private readonly repository: BillingRepositoryPort,
    private readonly transaction: BillingTransactionPort,
    private readonly logger: BillingLoggerPort,
  ) {}

  async create(command: CreateBillingCommand): Promise<void> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    await this.logger.record({
      traceId,
      correlationId,
      domain: 'billing',
      useCase: 'CreateBillingUseCase.create',
      aggregateId: command.id,
      commandName: 'CreateBillingCommand',
      outcome: 'started',
    });

    try {
      await this.transaction.run('billing.create', async (scope) => {
        const assignment = await this.assignmentState.findById(command.assignmentId);
        if (!assignment || assignment.version < command.requiredAssignmentVersion) {
          throw new AssignmentPreconditionNotReadyException(
            command.assignmentId,
            command.requiredAssignmentVersion,
            assignment?.version,
          );
        }
        if (assignment.status !== 'assigned') {
          throw new AssignmentNotBillableException(assignment.id, assignment.status);
        }

        await this.repository.save(
          BillingEntity.create({
            id: command.id,
            assignmentId: assignment.id,
            assignmentVersion: assignment.version,
          }),
          scope,
        );
      });

      await this.logger.record({
        traceId,
        correlationId,
        domain: 'billing',
        useCase: 'CreateBillingUseCase.create',
        aggregateId: command.id,
        commandName: 'CreateBillingCommand',
        outcome: 'success',
      });
    } catch (error) {
      await this.logger.record({
        traceId,
        correlationId,
        domain: 'billing',
        useCase: 'CreateBillingUseCase.create',
        aggregateId: command.id,
        commandName: 'CreateBillingCommand',
        outcome: 'failure',
        errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      });
      throw error;
    }
  }
}
