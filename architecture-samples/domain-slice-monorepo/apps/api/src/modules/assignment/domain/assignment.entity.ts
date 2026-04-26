import { toAssignmentId } from "./assignment.ids.js";
import { AssignmentCancelledException } from "./assignment.exceptions.js";
import type { AssignmentProps, AssignmentSnapshot } from "./assignment.types.js";

export class AssignmentEntity {
  private constructor(private readonly props: AssignmentProps) {}

  static create(input: { readonly id: string; readonly assigneeId: string; readonly now?: Date }): AssignmentEntity {
    const now = input.now ?? new Date();
    return new AssignmentEntity({
      id: toAssignmentId(input.id),
      assigneeId: input.assigneeId,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: AssignmentSnapshot): AssignmentEntity {
    return new AssignmentEntity({
      id: toAssignmentId(snapshot.id),
      assigneeId: snapshot.assigneeId,
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  assign(now = new Date()): AssignmentEntity {
    if (this.props.status === "cancelled") {
      throw new AssignmentCancelledException();
    }
    return new AssignmentEntity({ ...this.props, status: "assigned", updatedAt: now });
  }

  toSnapshot(): AssignmentSnapshot {
    return {
      id: this.props.id,
      assigneeId: this.props.assigneeId,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
