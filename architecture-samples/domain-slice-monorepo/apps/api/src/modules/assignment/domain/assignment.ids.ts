import { InvalidAssignmentIdException } from "./assignment.exceptions.js";

export type AssignmentId = string & { readonly __brand: "AssignmentId" };

export function toAssignmentId(value: string): AssignmentId {
  if (value.trim().length === 0) {
    throw new InvalidAssignmentIdException();
  }
  return value as AssignmentId;
}
