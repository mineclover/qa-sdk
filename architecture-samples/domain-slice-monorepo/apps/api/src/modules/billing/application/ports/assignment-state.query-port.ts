export interface AssignmentStateView {
  readonly id: string;
  readonly status: 'draft' | 'assigned' | 'cancelled';
  readonly version: number;
}

export abstract class AssignmentStateQueryPort {
  abstract findById(id: string): Promise<AssignmentStateView | null>;
}
