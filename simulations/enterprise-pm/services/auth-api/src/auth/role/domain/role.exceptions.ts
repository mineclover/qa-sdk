// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export class RoleDomainException extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "RoleDomainException";
  }
}

export class InvalidRoleInputException extends RoleDomainException {
  constructor(reason: string) {
    super("INVALID_ROLE_INPUT", reason);
    this.name = "ValidationError";
  }
}

export class DuplicateRoleNameException extends RoleDomainException {
  constructor(name: string) {
    super("DUPLICATE_ROLE_NAME", `Role already exists with name: ${name}`);
    this.name = "ConflictError";
  }
}

export class RoleNotFoundException extends RoleDomainException {
  constructor(roleId: string) {
    super("ROLE_NOT_FOUND", `Role not found: ${roleId}`);
    this.name = "NotFoundError";
  }
}
