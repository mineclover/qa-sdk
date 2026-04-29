// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { requestId } from "./middleware/request-id.js";
import { traceparent } from "./middleware/traceparent.js";
import { jwtVerifyMiddleware } from "./middleware/jwt-verify.js";
import { canaryOverrideMiddleware } from "./middleware/canary-override.js";
import { createHealthRoutes } from "./routes/health.js";
import { createLoginRoute } from "./routes/login.js";
import { createProxyRoutes, PROXY_TARGETS } from "./routes/proxy-routes.js";
import { createAdminRoutingRoute } from "./routes/admin-routing.js";
import { InMemoryRoutingStore } from "./routing/routing-table.js";
import { parseCidrList, type Cidr } from "./lib/internal-network.js";

export interface AppOptions {
  authApiUrl: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  /** unified bitmap version — version mismatch 시 401 + refresh_required. */
  currentBitmapV: string;
  proxyTimeoutMs: number;
  proxyTargets: Record<string, string>;
  /**
   * Plan C Stage 7 — controller가 push하는 routing 메모리 store.
   * 미지정 시 빈 store로 초기화 (legacy 호환 — proxy-routes는 등록되지 않은 service에
   * 대해 `proxyTargets`로 fall-through 한다).
   */
  routingStore?: InMemoryRoutingStore;
  /**
   * Plan C Stage 7 — internal IP CIDR (compose network). 미지정 시 빈 리스트
   * (override middleware/admin route 모두 외부 요청으로 간주 — silent strip / 404).
   */
  internalCidrs?: Cidr[];
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  const routingStore = opts.routingStore ?? new InMemoryRoutingStore();
  const internalCidrs = opts.internalCidrs ?? parseCidrList("");
  app.use("*", requestId);
  app.use("*", traceparent);
  // x-canary-override는 admin/health/login 보다 앞에 둘 필요 없음 — protected 요청에만 의미.
  app.use("*", canaryOverrideMiddleware({ internalCidrs }));

  // /admin/routing — controller만 호출 (자체 internal-IP guard).
  app.route("/", createAdminRoutingRoute({ store: routingStore, internalCidrs }));

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
    const kind = target.kind ?? "prefix";
    if (kind === "exact") {
      // path-param specific — `/users/:userId/projects` 처럼 정확 매칭만 보호.
      app.use(
        target.path,
        jwtVerifyMiddleware({
          secret: opts.jwtSecret,
          currentBitmapV: opts.currentBitmapV,
        }),
      );
    } else {
      // prefix — `/path` 와 `/path/*` 모두 보호.
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
  }
  app.route(
    "/",
    createProxyRoutes({
      targets: opts.proxyTargets,
      timeoutMs: opts.proxyTimeoutMs,
      routingStore, // Plan C 단계 7 — Task 7.8에서 fall-through 결정 흐름 사용.
    }),
  );

  return app;
}
