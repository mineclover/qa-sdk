import type { AssignmentCreatedPayload } from '@sample/contracts';

export interface AssignmentProjectedReadModel {
  readonly id: string;
  readonly assigneeId: string;
  readonly status: 'assigned';
  readonly updatedAt: string;
}

export class AssignmentReadModelProjector {
  private readonly rows = new Map<string, AssignmentProjectedReadModel>();

  async applyCreated(event: AssignmentCreatedPayload): Promise<void> {
    this.rows.set(event.id, {
      id: event.id,
      assigneeId: event.assigneeId,
      status: 'assigned',
      updatedAt: event.occurredAt,
    });
  }

  get(id: string): AssignmentProjectedReadModel | null {
    return this.rows.get(id) ?? null;
  }
}
