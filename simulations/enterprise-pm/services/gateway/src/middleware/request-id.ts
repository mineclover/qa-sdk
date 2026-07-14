// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';

export const requestId: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const id = incoming && /^[a-zA-Z0-9-_]{8,}$/.test(incoming) ? incoming : randomUUID();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
};
