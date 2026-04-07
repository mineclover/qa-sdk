import {
  EntryNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  ParseError,
  ValidationError,
  IndexMetaError,
} from "index-meta-workers";
import { IndexRangeError } from "weighted-index";
export { AppError } from "@qa-sdk/core";
import { AppError } from "@qa-sdk/core";

export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "RANGE_EXCEEDED"
  | "DECODER_NOT_LOADED"
  | "INTERNAL_ERROR";

export function notFound(message: string): AppError {
  return new AppError("NOT_FOUND", message, 404);
}

export function decoderNotLoaded(prefix: string, version: string): AppError {
  return new AppError(
    "DECODER_NOT_LOADED",
    `decoder not loaded for "${prefix}/${version}"`,
    404,
  );
}

/**
 * index-meta 에러 → AppError 변환.
 * 알려진 에러는 적절한 HTTP 상태 코드로 매핑한다.
 */
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
  if (err instanceof IndexRangeError) {
    return new AppError("RANGE_EXCEEDED", (err as Error).message, 400);
  }
  if (err instanceof IndexMetaError) {
    return new AppError("INTERNAL_ERROR", err.message, 500);
  }
  if (err instanceof Error) {
    return new AppError("INTERNAL_ERROR", err.message, 500);
  }
  return new AppError("INTERNAL_ERROR", "unknown error", 500);
}
