// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export class DepartmentDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DepartmentDomainException';
  }
}

export class InvalidDepartmentInputException extends DepartmentDomainException {
  constructor(reason: string) {
    super('INVALID_DEPARTMENT_INPUT', reason);
    this.name = 'ValidationError';
  }
}

export class DepartmentNotFoundException extends DepartmentDomainException {
  constructor(deptId: string) {
    super('DEPARTMENT_NOT_FOUND', `Department not found: ${deptId}`);
    this.name = 'NotFoundError';
  }
}

export class DepartmentCycleException extends DepartmentDomainException {
  constructor(deptId: string, parentId: string) {
    super('DEPARTMENT_CYCLE', `Setting parent ${parentId} on ${deptId} would create a cycle.`);
    this.name = 'ConflictError';
  }
}
