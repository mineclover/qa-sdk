import { IndexMetaError, ValidationError } from "index-meta";
export { AppError } from "@qa-sdk/core";
import { AppError } from "@qa-sdk/core";

export type ErrorCode =
  | "INVALID_INPUT"
  | "PREFIX_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "DRAFT_LOCKED"
  | "REF_NOT_FOUND"
  | "CIRCULAR_REF"
  | "NOT_READY"
  | "OVERFLOW"
  | "OWNER_MISMATCH"
  | "DUPLICATE_PREFIX"
  | "INTERNAL_ERROR";

export function badRequest(message: string): AppError {
  return new AppError("INVALID_INPUT", message, 400);
}

export function prefixNotFound(prefix: string): AppError {
  return new AppError("PREFIX_NOT_FOUND", `prefix '${prefix}' not found`, 404);
}

export function versionNotFound(prefix: string, versionId: string): AppError {
  return new AppError(
    "VERSION_NOT_FOUND",
    `version '${versionId}' not found for prefix '${prefix}'`,
    404,
  );
}

export function invalidTransition(message: string): AppError {
  return new AppError("INVALID_TRANSITION", message, 409);
}

export function draftLocked(prefix: string, versionId: string): AppError {
  return new AppError(
    "DRAFT_LOCKED",
    `draft '${prefix}/${versionId}' is locked`,
    409,
  );
}

export function refNotFound(prefix: string, versionId: string): AppError {
  return new AppError(
    "REF_NOT_FOUND",
    `ref target '${prefix}/${versionId}' not found`,
    400,
  );
}

export function circularRef(message: string): AppError {
  return new AppError("CIRCULAR_REF", message, 400);
}

export function notReady(message: string): AppError {
  return new AppError("NOT_READY", message, 409);
}

export function overflow(message: string): AppError {
  return new AppError("OVERFLOW", message, 400);
}

export function duplicatePrefix(prefix: string): AppError {
  return new AppError(
    "DUPLICATE_PREFIX",
    `prefix '${prefix}' already registered`,
    409,
  );
}

/** IndexMetaError → AppError 변환 */
export function fromIndexMetaError(err: unknown): AppError | null {
  if (err instanceof ValidationError) {
    return badRequest(err.message);
  }
  if (err instanceof IndexMetaError) {
    return new AppError("INTERNAL_ERROR", err.message, 500);
  }
  return null;
}
