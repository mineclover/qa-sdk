// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { toAssigneeId, toTaskId, toTaskProjectId } from './task.ids.js';
import { InvalidTaskTitleException, TaskTransitionDoneException } from './task.exceptions.js';
import type { TaskProps, TaskSnapshot, TaskStatus } from './task.types.js';

/**
 * Task Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 상태 전이는 새 인스턴스 반환 (불변)
 * - invariant: title 비어있을 수 없음, done → 다른 상태 전이 금지
 */
export class TaskEntity {
  private constructor(private readonly props: TaskProps) {}

  static create(input: {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly assigneeId?: string | null;
    readonly status?: TaskStatus;
    readonly parentTaskId?: string | null;
    readonly now?: Date;
  }): TaskEntity {
    if (input.title.trim().length === 0) {
      throw new InvalidTaskTitleException();
    }
    const now = input.now ?? new Date();
    return new TaskEntity({
      id: toTaskId(input.id),
      projectId: toTaskProjectId(input.projectId),
      title: input.title,
      assigneeId:
        input.assigneeId !== undefined && input.assigneeId !== null
          ? toAssigneeId(input.assigneeId)
          : null,
      status: input.status ?? 'todo',
      parentTaskId:
        input.parentTaskId !== undefined && input.parentTaskId !== null
          ? toTaskId(input.parentTaskId)
          : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: TaskSnapshot): TaskEntity {
    return new TaskEntity({
      id: toTaskId(snapshot.id),
      projectId: toTaskProjectId(snapshot.projectId),
      title: snapshot.title,
      assigneeId: snapshot.assigneeId !== null ? toAssigneeId(snapshot.assigneeId) : null,
      status: snapshot.status,
      parentTaskId: snapshot.parentTaskId !== null ? toTaskId(snapshot.parentTaskId) : null,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  /**
   * 상태 전이. done 상태에서 다른 상태로 전이하면 ConflictError.
   */
  transition(next: TaskStatus, now = new Date()): TaskEntity {
    if (this.props.status === 'done' && next !== 'done') {
      throw new TaskTransitionDoneException();
    }
    return new TaskEntity({ ...this.props, status: next, updatedAt: now });
  }

  /** patch 적용. title 비어있으면 예외. */
  applyPatch(
    patch: {
      readonly title?: string;
      readonly assigneeId?: string | null;
      readonly status?: TaskStatus;
      readonly parentTaskId?: string | null;
      readonly projectId?: string;
    },
    now = new Date(),
  ): TaskEntity {
    if (patch.title !== undefined && patch.title.trim().length === 0) {
      throw new InvalidTaskTitleException();
    }
    if (patch.status && this.props.status === 'done' && patch.status !== 'done') {
      throw new TaskTransitionDoneException();
    }
    const nextProps: TaskProps = {
      ...this.props,
      title: patch.title ?? this.props.title,
      assigneeId:
        patch.assigneeId === undefined
          ? this.props.assigneeId
          : patch.assigneeId === null
            ? null
            : toAssigneeId(patch.assigneeId),
      status: patch.status ?? this.props.status,
      parentTaskId:
        patch.parentTaskId === undefined
          ? this.props.parentTaskId
          : patch.parentTaskId === null
            ? null
            : toTaskId(patch.parentTaskId),
      projectId:
        patch.projectId !== undefined ? toTaskProjectId(patch.projectId) : this.props.projectId,
      updatedAt: now,
    };
    return new TaskEntity(nextProps);
  }

  toSnapshot(): TaskSnapshot {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      title: this.props.title,
      assigneeId: this.props.assigneeId,
      status: this.props.status,
      parentTaskId: this.props.parentTaskId,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get parentTaskId(): string | null {
    return this.props.parentTaskId;
  }
}
