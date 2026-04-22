// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

export class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

export class DepartmentNotFoundError extends Error {
  constructor(public readonly departmentId: string) {
    super(`Department not found: ${departmentId}`);
    this.name = "DepartmentNotFoundError";
  }
}

export class RoleNotFoundError extends Error {
  constructor(public readonly roleId: string) {
    super(`Role not found: ${roleId}`);
    this.name = "RoleNotFoundError";
  }
}

export class DuplicateUserError extends Error {
  constructor(public readonly email: string) {
    super(`User already exists: ${email}`);
    this.name = "DuplicateUserError";
  }
}

export class InvalidScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidScopeError";
  }
}
