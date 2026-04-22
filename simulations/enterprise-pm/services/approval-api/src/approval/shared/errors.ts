// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

export class RequestNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Request not found: ${id}`);
    this.name = "RequestNotFoundError";
  }
}
export class InvalidTransitionError extends Error {
  constructor(public readonly from: string, public readonly action: string) {
    super(`Invalid transition from ${from} via ${action}`);
    this.name = "InvalidTransitionError";
  }
}
export class StageMismatchError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Stage mismatch: expected ${expected}, got ${actual}`);
    this.name = "StageMismatchError";
  }
}
