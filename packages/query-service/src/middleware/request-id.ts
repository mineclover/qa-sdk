// @def.boundary query-api-spec
// @def.doc query-api-spec

import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header("x-request-id") ?? randomUUID();
  c.header("x-request-id", id);
  await next();
};
