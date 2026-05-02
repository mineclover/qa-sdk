// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

export class MemberDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MemberDomainException";
  }
}

export class InvalidMemberProjectIdException extends MemberDomainException {
  constructor() {
    super("INVALID_MEMBER_PROJECT_ID", "ProjectId must not be empty.");
    this.name = "ValidationError";
  }
}

export class InvalidMemberUserIdException extends MemberDomainException {
  constructor() {
    super("INVALID_MEMBER_USER_ID", "UserId must not be empty.");
    this.name = "ValidationError";
  }
}

export class MemberRoleConflictException extends MemberDomainException {
  constructor(role: string) {
    super("MEMBER_ROLE_CONFLICT", `Invalid member role transition for: ${role}`);
    this.name = "ConflictError";
  }
}

export class MemberNotFoundException extends MemberDomainException {
  constructor(projectId: string, userId: string) {
    super("MEMBER_NOT_FOUND", `Member not found: ${projectId}/${userId}`);
    this.name = "NotFoundError";
  }
}
