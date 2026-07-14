export class AssignmentDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AssignmentDomainException';
  }
}

export class InvalidAssignmentIdException extends AssignmentDomainException {
  constructor() {
    super('INVALID_ASSIGNMENT_ID', 'AssignmentId must not be empty.');
    this.name = 'InvalidAssignmentIdException';
  }
}

export class AssignmentCancelledException extends AssignmentDomainException {
  constructor() {
    super('ASSIGNMENT_CANCELLED', 'Cancelled assignment cannot be assigned.');
    this.name = 'AssignmentCancelledException';
  }
}
