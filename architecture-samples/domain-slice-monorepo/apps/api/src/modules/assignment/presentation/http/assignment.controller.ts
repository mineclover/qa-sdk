import type { CreateAssignmentCommand } from '../../application/commands/create-assignment.command.js';
import type { AssignmentUseCase } from '../../application/use-cases/assignment.use-case.js';

export class AssignmentController {
  constructor(private readonly useCase: AssignmentUseCase) {}

  async create(command: CreateAssignmentCommand): Promise<{ readonly ok: true }> {
    await this.useCase.create(command);
    return { ok: true };
  }
}
