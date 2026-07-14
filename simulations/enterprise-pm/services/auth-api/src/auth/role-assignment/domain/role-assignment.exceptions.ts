// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export class RoleAssignmentDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RoleAssignmentDomainException';
  }
}

export class InvalidRoleAssignmentInputException extends RoleAssignmentDomainException {
  constructor(reason: string) {
    super('INVALID_ROLE_ASSIGNMENT_INPUT', reason);
    this.name = 'ValidationError';
  }
}

export class DuplicateRoleAssignmentException extends RoleAssignmentDomainException {
  constructor(userId: string, roleId: string) {
    super(
      'DUPLICATE_ROLE_ASSIGNMENT',
      `Role assignment already exists for user=${userId} role=${roleId}.`,
    );
    this.name = 'ConflictError';
  }
}

export class RoleAssignmentNotFoundException extends RoleAssignmentDomainException {
  constructor(userId: string, roleId: string) {
    super(
      'ROLE_ASSIGNMENT_NOT_FOUND',
      `Role assignment not found for user=${userId} role=${roleId}.`,
    );
    this.name = 'NotFoundError';
  }
}

export class InvalidScopeException extends RoleAssignmentDomainException {
  constructor(message: string) {
    super('INVALID_SCOPE', message);
    this.name = 'ValidationError';
  }
}
