// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * /v1/insights — InsightsStore 기반 인사이트 API.
 *
 * InsightsStore 포트를 통해 조회하므로 드라이버(local/app-hub)에 무관하게 동일한 라우트.
 */

import { Hono } from "hono";
import type { InsightsStore } from "../ports/insights-store.port.js";

/** 쿼리 파라미터에서 정수를 안전하게 파싱. NaN 시 기본값, 상한 200 적용. */
function safeInt(raw: string | undefined, fallback: number, max = 200): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : Math.max(1, Math.min(n, max));
}

export interface InsightsDeps {
  store?: InsightsStore;
}

export function createInsightsRoutes(deps: InsightsDeps) {
  const app = new Hono();

  if (!deps.store) return app;
  const store = deps.store;

  // GET /v1/insights/summary — 전체 요약
  app.get("/v1/insights/summary", async (c) => {
    return c.json(await store.getSummary());
  });

  // GET /v1/insights/services — 서비스별 trace/record 분포
  app.get("/v1/insights/services", async (c) => {
    return c.json(await store.getServiceDistribution());
  });

  // GET /v1/insights/event-keys — 이벤트 키별 빈도
  app.get("/v1/insights/event-keys", async (c) => {
    return c.json(await store.getEventKeyFrequency());
  });

  // GET /v1/insights/prefixes — address_context prefix 사용 빈도
  app.get("/v1/insights/prefixes", async (c) => {
    const limit = safeInt(c.req.query("limit"), 500, 2000);
    return c.json(await store.getPrefixUsage({ limit }));
  });

  // GET /v1/insights/timeline — 시간대별 이벤트 분포
  app.get("/v1/insights/timeline", async (c) => {
    return c.json(await store.getTimeline());
  });

  // GET /v1/insights/flows — 이벤트 시퀀스 패턴 (trace별 event_key 체인)
  app.get("/v1/insights/flows", async (c) => {
    const limit = safeInt(c.req.query("limit"), 30);
    return c.json(await store.getFlows({ limit }));
  });

  // GET /v1/insights/sessions — 세션별 요약
  app.get("/v1/insights/sessions", async (c) => {
    return c.json(await store.getSessions());
  });

  // GET /v1/insights/coverage — 이벤트 카테고리별 커버리지
  app.get("/v1/insights/coverage", async (c) => {
    return c.json(await store.getCoverage());
  });

  // GET /v1/insights/permissions — 권한 체크 히스토리
  app.get("/v1/insights/permissions", async (c) => {
    const limit = safeInt(c.req.query("limit"), 50);
    return c.json(await store.getPermissionEvents({ limit }));
  });

  // GET /v1/insights/service-prefixes — 서비스별 prefix 활성도
  app.get("/v1/insights/service-prefixes", async (c) => {
    return c.json(await store.getServicePrefixes());
  });

  // GET /v1/insights/correlations — prefix 공출현 분석 + IntentLink 자동 제안
  app.get("/v1/insights/correlations", async (c) => {
    const minSupport = safeInt(c.req.query("min_support"), 2, 100);
    return c.json(await store.getCorrelations({ minSupport }));
  });

  // GET /v1/insights/errors — 에러 이벤트 히스토리
  app.get("/v1/insights/errors", async (c) => {
    const limit = safeInt(c.req.query("limit"), 50);
    return c.json(await store.getErrors({ limit }));
  });

  return app;
}
