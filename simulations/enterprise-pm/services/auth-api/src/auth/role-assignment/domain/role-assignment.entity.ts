// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { toUserId, toRoleId, makeRoleAssignmentId } from "./role-assignment.ids.js";
import { InvalidScopeException } from "./role-assignment.exceptions.js";
import type {
  AssignmentScopeType,
  RoleAssignmentProps,
  RoleAssignmentSnapshot,
} from "./role-assignment.types.js";

const ALLOWED_SCOPES: ReadonlySet<AssignmentScopeType> = new Set(["global", "department", "project"]);

/**
 * RoleAssignment Aggregate Root.
 *
 * Composite key: userId + roleId + scopeType + scopeId.
 * Invariants:
 *   - scopeType ∈ {global, department, project}
 *   - scopeType=global → scopeId 는 null 권장 (sentinel '' / null 모두 허용)
 *   - scopeType ∈ {department, project} → scopeId 가 null 일 수 없음
 */
export class RoleAssignmentEntity {
  private constructor(private readonly props: RoleAssignmentProps) {}

  static create(input: {
    readonly userId: string;
    readonly roleId: string;
    readonly scopeType: AssignmentScopeType;
    readonly scopeId: string | null;
    readonly now?: Date;
  }): RoleAssignmentEntity {
    if (!ALLOWED_SCOPES.has(input.scopeType)) {
      throw new InvalidScopeException(`Unknown scopeType=${input.scopeType}`);
    }
    if ((input.scopeType === "department" || input.scopeType === "project") && input.scopeId === null) {
      throw new InvalidScopeException(
        `scopeType=${input.scopeType} requires scopeId to be non-null.`,
      );
    }
    const now = input.now ?? new Date();
    return new RoleAssignmentEntity({
      id: makeRoleAssignmentId(input.userId, input.roleId, input.scopeType, input.scopeId),
      userId: toUserId(input.userId),
      roleId: toRoleId(input.roleId),
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      assignedAt: now,
    });
  }

  static rehydrate(snapshot: RoleAssignmentSnapshot): RoleAssignmentEntity {
    return new RoleAssignmentEntity({
      id: makeRoleAssignmentId(snapshot.userId, snapshot.roleId, snapshot.scopeType, snapshot.scopeId),
      userId: toUserId(snapshot.userId),
      roleId: toRoleId(snapshot.roleId),
      scopeType: snapshot.scopeType,
      scopeId: snapshot.scopeId,
      assignedAt: new Date(snapshot.assignedAt),
    });
  }

  toSnapshot(): RoleAssignmentSnapshot {
    return {
      id: this.props.id,
      userId: this.props.userId,
      roleId: this.props.roleId,
      scopeType: this.props.scopeType,
      scopeId: this.props.scopeId,
      assignedAt: this.props.assignedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }
}
