export type ErrorCode =
  | "INVALID_INPUT"
  | "SERVICE_NOT_FOUND"
  | "SERVICE_NAME_CONFLICT"
  | "EVENT_NOT_FOUND"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(code: ErrorCode, message: string): AppError {
  return new AppError(code, message, 404);
}

export function conflict(code: ErrorCode, message: string): AppError {
  return new AppError(code, message, 409);
}
