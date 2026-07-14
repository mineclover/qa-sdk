// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { toDepartmentId, toManagerId } from './department.ids.js';
import { InvalidDepartmentInputException } from './department.exceptions.js';
import type { DepartmentProps, DepartmentSnapshot } from './department.types.js';

/**
 * Department Aggregate Root.
 *
 * Cycle 검출은 use-case 가 책임진다 (entity 는 트리 전체를 모르므로). entity
 * 는 단일 노드의 invariant 만 검사.
 */
export class DepartmentEntity {
  private constructor(private readonly props: DepartmentProps) {}

  static create(input: {
    readonly id: string;
    readonly name: string;
    readonly parentId?: string | null;
    readonly managerId?: string | null;
    readonly now?: Date;
  }): DepartmentEntity {
    if (input.name.trim().length === 0) {
      throw new InvalidDepartmentInputException('Department name must not be empty.');
    }
    const now = input.now ?? new Date();
    return new DepartmentEntity({
      id: toDepartmentId(input.id),
      name: input.name,
      parentId: input.parentId ? toDepartmentId(input.parentId) : null,
      managerId: input.managerId ? toManagerId(input.managerId) : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: DepartmentSnapshot): DepartmentEntity {
    return new DepartmentEntity({
      id: toDepartmentId(snapshot.id),
      name: snapshot.name,
      parentId: snapshot.parentId ? toDepartmentId(snapshot.parentId) : null,
      managerId: snapshot.managerId ? toManagerId(snapshot.managerId) : null,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  updateProfile(
    patch: {
      readonly name?: string;
      readonly parentId?: string | null;
      readonly managerId?: string | null;
    },
    now: Date = new Date(),
  ): DepartmentEntity {
    const nextName = patch.name !== undefined ? patch.name : this.props.name;
    if (nextName.trim().length === 0) {
      throw new InvalidDepartmentInputException('Department name must not be empty.');
    }
    const nextParent =
      patch.parentId === undefined
        ? this.props.parentId
        : patch.parentId === null
          ? null
          : toDepartmentId(patch.parentId);
    const nextManager =
      patch.managerId === undefined
        ? this.props.managerId
        : patch.managerId === null
          ? null
          : toManagerId(patch.managerId);
    return new DepartmentEntity({
      ...this.props,
      name: nextName,
      parentId: nextParent,
      managerId: nextManager,
      updatedAt: now,
    });
  }

  toSnapshot(): DepartmentSnapshot {
    return {
      id: this.props.id,
      name: this.props.name,
      parentId: this.props.parentId,
      managerId: this.props.managerId,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }
}
