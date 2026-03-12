export type ErrorCode =
  | "INVALID_INPUT"
  | "TRACE_NOT_FOUND"
  | "GRAPH_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "SCENARIO_NOT_FOUND"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function badRequest(message: string): AppError {
  return new AppError("INVALID_INPUT", message, 400);
}

export function traceNotFound(traceId: string): AppError {
  return new AppError("TRACE_NOT_FOUND", `trace '${traceId}' not found`, 404);
}

export function graphNotFound(traceId: string): AppError {
  return new AppError(
    "GRAPH_NOT_FOUND",
    `runtime graph for trace '${traceId}' not found`,
    404,
  );
}

export function sessionNotFound(sessionId: string): AppError {
  return new AppError(
    "SESSION_NOT_FOUND",
    `session '${sessionId}' not found`,
    404,
  );
}

export function scenarioNotFound(scenarioId: string): AppError {
  return new AppError(
    "SCENARIO_NOT_FOUND",
    `scenario '${scenarioId}' not found`,
    404,
  );
}
