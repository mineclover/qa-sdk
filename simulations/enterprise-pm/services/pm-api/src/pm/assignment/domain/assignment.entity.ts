// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { toAssignmentId, toManagerId, toProjectId } from './assignment.ids.js';
import { AssignmentCancelledException } from './assignment.exceptions.js';
import type { AssignmentProps, AssignmentSnapshot } from './assignment.types.js';

/**
 * Assignment Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 상태 전이는 새 인스턴스 반환 (불변)
 * - invariant: cancelled 는 terminal — assign 시 ConflictError
 */
export class AssignmentEntity {
  private constructor(private readonly props: AssignmentProps) {}

  static create(input: {
    readonly id: string;
    readonly projectId: string;
    readonly managerId: string;
    readonly now?: Date;
  }): AssignmentEntity {
    const now = input.now ?? new Date();
    return new AssignmentEntity({
      id: toAssignmentId(input.id),
      projectId: toProjectId(input.projectId),
      managerId: toManagerId(input.managerId),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: AssignmentSnapshot): AssignmentEntity {
    return new AssignmentEntity({
      id: toAssignmentId(snapshot.id),
      projectId: toProjectId(snapshot.projectId),
      managerId: toManagerId(snapshot.managerId),
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  /** draft → assigned. cancelled 에서 호출 시 ConflictError. */
  assign(now = new Date()): AssignmentEntity {
    if (this.props.status === 'cancelled') {
      throw new AssignmentCancelledException();
    }
    return new AssignmentEntity({ ...this.props, status: 'assigned', updatedAt: now });
  }

  toSnapshot(): AssignmentSnapshot {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      managerId: this.props.managerId,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get status(): 'draft' | 'assigned' | 'cancelled' {
    return this.props.status;
  }
}
