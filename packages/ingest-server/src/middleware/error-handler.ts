import type { ErrorHandler } from "hono";
import { AppError } from "../lib/errors.js";
import { ZodError } from "zod";
import type { Logger } from "pino";

export function createErrorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.statusCode as 400 | 404 | 500,
      );
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

    logger.error(
      {
        err,
        requestId: c.res.headers.get("x-request-id"),
      },
      "unhandled error",
    );
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "internal server error" } },
      500,
    );
  };
}
