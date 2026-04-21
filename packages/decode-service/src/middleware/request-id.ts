// @def.boundary decode-service-system
// @def.doc decode-service-spec

import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header("x-request-id") ?? randomUUID();
  c.header("x-request-id", id);
  await next();
};
