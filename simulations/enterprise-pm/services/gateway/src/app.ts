// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { requestId } from "./middleware/request-id.js";
import { traceparent } from "./middleware/traceparent.js";
import { jwtVerifyMiddleware } from "./middleware/jwt-verify.js";
import { createHealthRoutes } from "./routes/health.js";
import { createLoginRoute } from "./routes/login.js";
import { createProxyRoutes, PROXY_TARGETS } from "./routes/proxy-routes.js";

export interface AppOptions {
  authApiUrl: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  /** unified bitmap version — version mismatch 시 401 + refresh_required. */
  currentBitmapV: string;
  proxyTimeoutMs: number;
  proxyTargets: Record<string, string>;
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  app.use("*", requestId);
  app.use("*", traceparent);

  // /health 는 unprotected
  app.route("/", createHealthRoutes());

  // /auth/login 은 unprotected (인증 자체)
  app.route(
    "/",
    createLoginRoute({
      authApiUrl: opts.authApiUrl,
      jwtSecret: opts.jwtSecret,
      jwtTtlSeconds: opts.jwtTtlSeconds,
    }),
  );

  // protected routes — JWT verify
  for (const target of PROXY_TARGETS) {
    app.use(
      `${target.path}/*`,
      jwtVerifyMiddleware({
        secret: opts.jwtSecret,
        currentBitmapV: opts.currentBitmapV,
      }),
    );
    app.use(
      target.path,
      jwtVerifyMiddleware({
        secret: opts.jwtSecret,
        currentBitmapV: opts.currentBitmapV,
      }),
    );
  }
  app.route(
    "/",
    createProxyRoutes({
      targets: opts.proxyTargets,
      timeoutMs: opts.proxyTimeoutMs,
    }),
  );

  return app;
}
