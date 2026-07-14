export interface AssignmentDetailReadModel {
  readonly id: string;
  readonly assigneeId: string;
  readonly status: string;
  readonly updatedAt: string;
}

export abstract class AssignmentReadModelPort {
  abstract findDetail(id: string): Promise<AssignmentDetailReadModel | null>;
}
