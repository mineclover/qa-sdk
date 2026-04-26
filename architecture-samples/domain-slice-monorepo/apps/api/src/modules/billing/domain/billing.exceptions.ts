export class BillingDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BillingDomainException";
  }
}

export class AssignmentPreconditionNotReadyException extends BillingDomainException {
  constructor(readonly assignmentId: string, readonly requiredVersion: number, readonly actualVersion?: number) {
    super(
      "ASSIGNMENT_PRECONDITION_NOT_READY",
      `Assignment ${assignmentId} is not ready for billing.`,
    );
    this.name = "AssignmentPreconditionNotReadyException";
  }
}

export class AssignmentNotBillableException extends BillingDomainException {
  constructor(readonly assignmentId: string, readonly status: string) {
    super("ASSIGNMENT_NOT_BILLABLE", `Assignment ${assignmentId} is ${status}.`);
    this.name = "AssignmentNotBillableException";
  }
}
