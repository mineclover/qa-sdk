import type { Context } from "hono";
import type { ErrorCode } from "./errors.js";

export function errorJson(
  c: Context,
  statusCode: number,
  code: ErrorCode,
  message: string,
) {
  return c.json({ error: { code, message } }, statusCode as any);
}
