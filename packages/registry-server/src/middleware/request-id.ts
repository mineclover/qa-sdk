import type { MiddlewareHandler } from "hono";
import { ulid } from "ulid";

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header("x-request-id") ?? ulid();
  c.set("requestId", id);
  c.header("x-request-id", id);
  await next();
};
