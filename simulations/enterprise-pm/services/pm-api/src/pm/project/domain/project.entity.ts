// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  toDepartmentId,
  toProjectId,
  toProjectOwnerId,
} from "./project.ids.js";
import {
  InvalidProjectNameException,
  ProjectArchivedException,
  ProjectStatusTransitionException,
} from "./project.exceptions.js";
import type {
  ProjectProps,
  ProjectSnapshot,
  ProjectStatus,
} from "./project.types.js";

/**
 * Project Aggregate Root.
 *
 * 라이프사이클: draft → active → archived (terminal).
 * - draft → active: activate()
 * - active → archived: archive()
 * - archived 에서 다른 상태로 전이 금지
 * - archived 상태에서는 patch 불가 (ConflictError)
 */
export class ProjectEntity {
  private constructor(private readonly props: ProjectProps) {}

  static create(input: {
    readonly id: string;
    readonly name: string;
    readonly ownerId: string;
    readonly departmentId: string;
    readonly status?: ProjectStatus;
    readonly now?: Date;
  }): ProjectEntity {
    if (input.name.trim().length === 0) {
      throw new InvalidProjectNameException();
    }
    const now = input.now ?? new Date();
    return new ProjectEntity({
      id: toProjectId(input.id),
      name: input.name,
      ownerId: toProjectOwnerId(input.ownerId),
      departmentId: toDepartmentId(input.departmentId),
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: ProjectSnapshot): ProjectEntity {
    return new ProjectEntity({
      id: toProjectId(snapshot.id),
      name: snapshot.name,
      ownerId: toProjectOwnerId(snapshot.ownerId),
      departmentId: toDepartmentId(snapshot.departmentId),
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  /** draft → active 전이. */
  activate(now = new Date()): ProjectEntity {
    if (this.props.status === "archived") {
      throw new ProjectArchivedException();
    }
    if (this.props.status === "active") return this;
    return new ProjectEntity({ ...this.props, status: "active", updatedAt: now });
  }

  /** active → archived 전이 (terminal). draft 에서도 archive 가능. */
  archive(now = new Date()): ProjectEntity {
    if (this.props.status === "archived") return this;
    return new ProjectEntity({ ...this.props, status: "archived", updatedAt: now });
  }

  /** patch 적용. archived 에서는 ConflictError. */
  applyPatch(patch: {
    readonly name?: string;
    readonly ownerId?: string;
    readonly departmentId?: string;
    readonly status?: ProjectStatus;
  }, now = new Date()): ProjectEntity {
    if (this.props.status === "archived") {
      throw new ProjectArchivedException();
    }
    if (patch.name !== undefined && patch.name.trim().length === 0) {
      throw new InvalidProjectNameException();
    }
    // status 전이 invariant 검증.
    if (patch.status && patch.status !== this.props.status) {
      const ok = isValidStatusTransition(this.props.status, patch.status);
      if (!ok) {
        throw new ProjectStatusTransitionException(this.props.status, patch.status);
      }
    }
    const nextProps: ProjectProps = {
      ...this.props,
      name: patch.name ?? this.props.name,
      ownerId: patch.ownerId !== undefined ? toProjectOwnerId(patch.ownerId) : this.props.ownerId,
      departmentId:
        patch.departmentId !== undefined ? toDepartmentId(patch.departmentId) : this.props.departmentId,
      status: patch.status ?? this.props.status,
      updatedAt: now,
    };
    return new ProjectEntity(nextProps);
  }

  toSnapshot(): ProjectSnapshot {
    return {
      id: this.props.id,
      name: this.props.name,
      ownerId: this.props.ownerId,
      departmentId: this.props.departmentId,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get status(): ProjectStatus {
    return this.props.status;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get departmentId(): string {
    return this.props.departmentId;
  }
}

function isValidStatusTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return true;
  if (from === "archived") return false;
  if (from === "draft" && (to === "active" || to === "archived")) return true;
  if (from === "active" && to === "archived") return true;
  return false;
}
