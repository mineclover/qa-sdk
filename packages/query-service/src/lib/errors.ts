import {
  EntryNotFoundError,
  IndexMetaError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  ParseError,
  ValidationError,
} from "index-meta";
import {
  PolicyRuleAlreadyExistsError,
  PolicyRuleNotFoundError,
} from "../stores/policy-rule-store.js";
export { AppError } from "@qa-sdk/core";
import { AppError } from "@qa-sdk/core";

export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export function fromServiceError(err: unknown): AppError {
  if (err instanceof EntryNotFoundError) {
    return new AppError("NOT_FOUND", err.message, 404);
  }
  if (err instanceof IndexNotFoundError || err instanceof IndexVersionNotFoundError) {
    return new AppError("NOT_FOUND", err.message, 404);
  }
  if (err instanceof PolicyRuleNotFoundError) {
    return new AppError("NOT_FOUND", err.message, 404);
  }
  if (err instanceof PolicyRuleAlreadyExistsError) {
    return new AppError("CONFLICT", err.message, 409);
  }
  if (err instanceof ParseError || err instanceof RangeError || err instanceof ValidationError) {
    return new AppError("INVALID_INPUT", err.message, 400);
  }
  if (err instanceof SyntaxError) {
    return new AppError("INVALID_INPUT", err.message, 400);
  }
  if (err instanceof IndexMetaError) {
    return new AppError("INTERNAL_ERROR", err.message, 500);
  }
  if (err instanceof Error) {
    return new AppError("INTERNAL_ERROR", err.message, 500);
  }
  return new AppError("INTERNAL_ERROR", "unknown error", 500);
}
