import type { MiddlewareHandler } from "hono";
import type { Logger } from "pino";

export function createRequestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();

    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration_ms: Date.now() - start,
      },
      "request completed",
    );
  };
}
