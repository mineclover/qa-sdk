// @def.boundary gate-system
// @def.doc gate-system

import {
  EntryNotFoundError,
  IndexMetaError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  ParseError,
  ValidationError,
} from "index-meta-workers";
export { AppError } from "@qa-sdk/core";
import { AppError } from "@qa-sdk/core";

export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "INTERNAL_ERROR";

export function fromIndexMetaError(err: unknown): AppError {
  if (err instanceof EntryNotFoundError) {
    return new AppError("NOT_FOUND", err.message, 404);
  }
  if (err instanceof IndexNotFoundError || err instanceof IndexVersionNotFoundError) {
    return new AppError("NOT_FOUND", err.message, 404);
  }
  if (err instanceof ParseError) {
    return new AppError("PARSE_ERROR", err.message, 400);
  }
  if (err instanceof ValidationError) {
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
