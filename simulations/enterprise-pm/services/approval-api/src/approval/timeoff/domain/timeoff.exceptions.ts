// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export class TimeOffDomainException extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "TimeOffDomainException";
  }
}

export class InvalidTimeOffIdException extends TimeOffDomainException {
  constructor() {
    super("INVALID_TIMEOFF_ID", "TimeOffRequestId must not be empty.");
    this.name = "ValidationError";
  }
}

export class InvalidTimeOffRangeException extends TimeOffDomainException {
  constructor(start: string, end: string) {
    super("INVALID_TIMEOFF_RANGE", `Invalid time-off range: start=${start} > end=${end}.`);
    this.name = "ValidationError";
  }
}

export class TimeOffStatusConflictException extends TimeOffDomainException {
  constructor(from: string, to: string) {
    super("TIMEOFF_STATUS_CONFLICT", `Invalid time-off status transition: ${from} → ${to}.`);
    this.name = "ConflictError";
  }
}

export class TimeOffNotFoundException extends TimeOffDomainException {
  constructor(id: string) {
    super("TIMEOFF_NOT_FOUND", `Time-off request not found: ${id}.`);
    this.name = "NotFoundError";
  }
}
