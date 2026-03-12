import type { ErrorHandler } from "hono";
import { ZodError } from "zod";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      { error: { code: "INVALID_INPUT", message: err.errors } },
      400,
    );
  }

  console.error("unhandled error:", err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "internal server error" } },
    500,
  );
};
