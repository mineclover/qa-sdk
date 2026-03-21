export { AppError } from "@qa-sdk/core";
import { AppError } from "@qa-sdk/core";

export type ErrorCode =
  | "INVALID_INPUT"
  | "SERVICE_NOT_FOUND"
  | "SERVICE_NAME_CONFLICT"
  | "EVENT_NOT_FOUND"
  | "INTERNAL_ERROR";

export function notFound(code: ErrorCode, message: string): AppError {
  return new AppError(code, message, 404);
}

export function conflict(code: ErrorCode, message: string): AppError {
  return new AppError(code, message, 409);
}
