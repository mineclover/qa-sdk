import type { ErrorHandler } from "hono";
import { toMotionWorkspaceServiceError } from "./errors.js";

export interface MotionWorkspaceServiceLogger {
  error(...args: unknown[]): void;
}

export function createErrorHandler(
  logger: MotionWorkspaceServiceLogger,
): ErrorHandler {
  return (error, c) => {
    const appError = toMotionWorkspaceServiceError(error);

    if (appError.statusCode >= 500) {
      logger.error(error);
    }

    return c.json(
      appError.shape,
      appError.statusCode as 400 | 404 | 409 | 500,
    );
  };
}
