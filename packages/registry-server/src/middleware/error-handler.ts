import type { Context, ErrorHandler } from "hono";
import type { Logger } from "pino";
import { AppError } from "../lib/errors.js";
import { ZodError } from "zod";

export function createErrorHandler(logger: Logger): ErrorHandler {
  return (err: Error, c: Context) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.statusCode as any,
      );
    }

    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: err.errors
              .map((e) => `${e.path.join(".")}: ${e.message}`)
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
