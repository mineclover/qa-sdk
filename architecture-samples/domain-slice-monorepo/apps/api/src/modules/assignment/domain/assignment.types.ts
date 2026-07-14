import type { AssignmentId } from './assignment.ids.js';

export type AssignmentStatus = 'draft' | 'assigned' | 'cancelled';

export interface AssignmentProps {
  readonly id: AssignmentId;
  readonly assigneeId: string;
  readonly status: AssignmentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AssignmentSnapshot {
  readonly id: string;
  readonly assigneeId: string;
  readonly status: AssignmentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
