import type { ErrorHandler } from "hono";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError, fromServiceError } from "../lib/errors.js";

export function createErrorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    if (err instanceof AppError) {
      return c.json({
        error: { code: err.code, message: err.message },
        ...err.extras,
      }, err.statusCode as 400 | 404 | 409 | 500 | 503);
    }

    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: err.errors
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; "),
          },
        },
        400,
      );
    }

    const appErr = fromServiceError(err);
    if (appErr.statusCode !== 500) {
      return c.json(
        { error: { code: appErr.code, message: appErr.message } },
        appErr.statusCode as 400 | 404 | 409 | 503,
      );
    }

    logger.error({ err }, "unhandled error");
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "internal server error" } },
      500,
    );
  };
}
