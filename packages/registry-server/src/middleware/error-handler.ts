import type { Context } from "hono";
import { AppError } from "../lib/errors.js";
import { ZodError } from "zod";

export function errorHandler(err: Error, c: Context) {
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
          message: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
        },
      },
      400,
    );
  }

  console.error("Unhandled error:", err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "internal server error" } },
    500,
  );
}
