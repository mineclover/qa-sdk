// @def.boundary ingest-system
// @def.doc ingest-system

import type { Context, MiddlewareHandler } from 'hono';
import type { AppLifecycle } from '../lib/app-lifecycle.js';

const SHUTDOWN_ERROR = {
  error: {
    code: 'SERVER_SHUTTING_DOWN',
    message: 'server is shutting down',
  },
};

export function createShutdownMiddleware(appLifecycle: AppLifecycle): MiddlewareHandler {
  return async (c, next) => {
    if (isTrackedIngestRequest(c)) {
      const finishIngestRequest = appLifecycle.tryStartIngestRequest();

      if (!finishIngestRequest) {
        return respondServerShuttingDown(c);
      }

      try {
        await next();
      } finally {
        finishIngestRequest();
      }

      return;
    }

    if (appLifecycle.isShuttingDown()) {
      return respondServerShuttingDown(c);
    }

    await next();
  };
}

export function respondServerShuttingDown(c: Context) {
  return c.json(SHUTDOWN_ERROR, 503);
}

function isTrackedIngestRequest(c: Context) {
  return c.req.method === 'POST' && c.req.path === '/v1/ingest';
}
