// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { toMemberProjectId, toMemberUserId } from "./member.ids.js";
import { MemberRoleConflictException } from "./member.exceptions.js";
import type {
  MemberProps,
  MemberRole,
  MemberSnapshot,
} from "./member.types.js";

/**
 * Member Aggregate.
 *
 * - composite key (projectId, userId)
 * - role 전이는 invariant: lead 는 강등 가능, viewer 에서 lead 는 ConflictError (정책)
 */
export class MemberEntity {
  private constructor(private readonly props: MemberProps) {}

  static create(input: {
    readonly projectId: string;
    readonly userId: string;
    readonly role: MemberRole;
    readonly now?: Date;
  }): MemberEntity {
    const now = input.now ?? new Date();
    return new MemberEntity({
      projectId: toMemberProjectId(input.projectId),
      userId: toMemberUserId(input.userId),
      role: input.role,
      joinedAt: now,
    });
  }

  static rehydrate(snapshot: MemberSnapshot): MemberEntity {
    return new MemberEntity({
      projectId: toMemberProjectId(snapshot.projectId),
      userId: toMemberUserId(snapshot.userId),
      role: snapshot.role,
      joinedAt: new Date(snapshot.joinedAt),
    });
  }

  /**
   * 역할 변경. viewer → lead 는 직접 전이 금지 (contributor 경유 정책).
   */
  changeRole(next: MemberRole): MemberEntity {
    if (this.props.role === "viewer" && next === "lead") {
      throw new MemberRoleConflictException(`viewer -> lead`);
    }
    return new MemberEntity({ ...this.props, role: next });
  }

  toSnapshot(): MemberSnapshot {
    return {
      projectId: this.props.projectId,
      userId: this.props.userId,
      role: this.props.role,
      joinedAt: this.props.joinedAt.toISOString(),
    };
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get role(): MemberRole {
    return this.props.role;
  }
}
