// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { toUserId, toDepartmentId, toRoleId } from "./user.ids.js";
import { InvalidUserInputException } from "./user.exceptions.js";
import type { UserProps, UserSnapshot, UserStatus } from "./user.types.js";

/**
 * User Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 상태 전이는 새 인스턴스 반환 (불변)
 * - invariants:
 *     · email 비어 있으면 ValidationError
 *     · displayName 비어 있으면 ValidationError
 *     · status 'deleted' 에서 update/markDeleted 호출은 무동작 (idempotent)
 */
export class UserEntity {
  private constructor(private readonly props: UserProps) {}

  static create(input: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly departmentId?: string | null;
    readonly primaryRoleId?: string | null;
    readonly now?: Date;
  }): UserEntity {
    const trimmedEmail = input.email.trim();
    if (trimmedEmail.length === 0) {
      throw new InvalidUserInputException("email must not be empty.");
    }
    if (input.displayName.trim().length === 0) {
      throw new InvalidUserInputException("displayName must not be empty.");
    }
    const now = input.now ?? new Date();
    return new UserEntity({
      id: toUserId(input.id),
      email: trimmedEmail,
      displayName: input.displayName,
      departmentId: input.departmentId ? toDepartmentId(input.departmentId) : null,
      primaryRoleId: input.primaryRoleId ? toRoleId(input.primaryRoleId) : null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: UserSnapshot): UserEntity {
    return new UserEntity({
      id: toUserId(snapshot.id),
      email: snapshot.email,
      displayName: snapshot.displayName,
      departmentId: snapshot.departmentId ? toDepartmentId(snapshot.departmentId) : null,
      primaryRoleId: snapshot.primaryRoleId ? toRoleId(snapshot.primaryRoleId) : null,
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  /** displayName / departmentId / primaryRoleId 부분 갱신. */
  updateProfile(
    patch: {
      readonly email?: string;
      readonly displayName?: string;
      readonly departmentId?: string | null;
      readonly primaryRoleId?: string | null;
    },
    now: Date = new Date(),
  ): UserEntity {
    const nextEmail = patch.email !== undefined ? patch.email.trim() : this.props.email;
    if (nextEmail.length === 0) {
      throw new InvalidUserInputException("email must not be empty.");
    }
    const nextDisplayName =
      patch.displayName !== undefined ? patch.displayName : this.props.displayName;
    if (nextDisplayName.trim().length === 0) {
      throw new InvalidUserInputException("displayName must not be empty.");
    }
    const nextDeptId =
      patch.departmentId === undefined
        ? this.props.departmentId
        : patch.departmentId === null
          ? null
          : toDepartmentId(patch.departmentId);
    const nextRoleId =
      patch.primaryRoleId === undefined
        ? this.props.primaryRoleId
        : patch.primaryRoleId === null
          ? null
          : toRoleId(patch.primaryRoleId);
    return new UserEntity({
      ...this.props,
      email: nextEmail,
      displayName: nextDisplayName,
      departmentId: nextDeptId,
      primaryRoleId: nextRoleId,
      updatedAt: now,
    });
  }

  toSnapshot(): UserSnapshot {
    return {
      id: this.props.id,
      email: this.props.email,
      displayName: this.props.displayName,
      departmentId: this.props.departmentId,
      primaryRoleId: this.props.primaryRoleId,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get email(): string {
    return this.props.email;
  }
}
