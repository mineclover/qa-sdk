/**
 * /api/health/services — 등록된 서비스의 /health 병렬 호출 집계.
 *
 * registry에 등록된 서비스 URL 목록을 기반으로 각 서비스의 /health를 호출하고
 * 결과를 집계하여 전체 시스템 상태를 반환한다.
 */

import { Hono } from "hono";
import type { ConfigStore } from "../stores/config-store.js";
import type { ServiceEndpointStore } from "../stores/service-endpoint-store.js";

export interface ServiceHealthRouteDeps {
  configStore: ConfigStore;
  endpointStore?: ServiceEndpointStore;
}

interface ServiceHealthResult {
  serviceId: string;
  url: string;
  status: "up" | "down" | "unknown";
  latencyMs: number;
  detail?: Record<string, unknown>;
  error?: string;
}

interface ServiceRecord {
  serviceId: string;
  url?: string;
  urls?: Record<string, string>;
  tier?: string;
  gatewayPath?: string;
}

async function checkHealth(
  serviceId: string,
  baseUrl: string,
): Promise<ServiceHealthResult> {
  const start = Date.now();
  const url = baseUrl.replace(/\/$/, "");

  try {
    const resp = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const latencyMs = Date.now() - start;

    if (resp.ok) {
      let detail: Record<string, unknown> | undefined;
      try {
        detail = await resp.json() as Record<string, unknown>;
      } catch { /* non-json response */ }
      return { serviceId, url, status: "up", latencyMs, detail };
    }

    return {
      serviceId,
      url,
      status: "down",
      latencyMs,
      error: `HTTP ${resp.status}`,
    };
  } catch (err) {
    return {
      serviceId,
      url,
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function createServiceHealthRoutes(deps: ServiceHealthRouteDeps) {
  const routes = new Hono();

  /**
   * GET /api/health/services — 전체 서비스 헬스체크
   *
   * ?env=dev (기본)  — 환경별 URL 선택
   * ?timeout=5000    — 개별 서비스 타임아웃 (ms)
   *
   * 응답:
   * {
   *   status: "healthy" | "degraded" | "unhealthy",
   *   total: 7,
   *   up: 5,
   *   down: 2,
   *   services: [ ... ]
   * }
   */
  routes.get("/api/health/services", async (c) => {
    const catalogId = c.req.query("catalog") ?? "demo";
    const envName = c.req.query("env") ?? "dev";
    const namespace = c.req.query("namespace") ?? "shop";
    const region = c.req.query("region") ?? "asia";

    // 서비스 목록 로드
    const record = await deps.configStore.get(catalogId, "services");
    if (!record) {
      return c.json({ error: "No services registered" }, 404);
    }

    let services: ServiceRecord[];
    try {
      services = JSON.parse(record.data);
    } catch {
      return c.json({ error: "Invalid services data" }, 500);
    }

    // endpoint 테이블에서 URL 맵 구성
    const epUrls: Record<string, string> = {};
    if (deps.endpointStore) {
      const endpoints = await deps.endpointStore.list(catalogId);
      for (const ep of endpoints) {
        if (ep.env === envName && ep.region === region && ep.namespace === namespace) {
          epUrls[ep.svcName] = ep.url;
        }
      }
    }

    // URL이 있는 서비스만 헬스체크 대상
    const targets: Array<{ serviceId: string; url: string; tier?: string }> = [];
    for (const svc of services) {
      const url = epUrls[svc.serviceId] ?? svc.urls?.[envName] ?? svc.url;
      if (url) {
        targets.push({ serviceId: svc.serviceId, url, tier: svc.tier });
      }
    }

    // 병렬 헬스체크
    const results = await Promise.all(
      targets.map((t) => checkHealth(t.serviceId, t.url)),
    );

    const up = results.filter((r) => r.status === "up").length;
    const down = results.filter((r) => r.status === "down").length;
    const total = results.length;

    let status: "healthy" | "degraded" | "unhealthy";
    if (down === 0) status = "healthy";
    else if (up > 0) status = "degraded";
    else status = "unhealthy";

    return c.json({
      status,
      total,
      up,
      down,
      checkedAt: new Date().toISOString(),
      env: envName,
      services: results.map((r) => ({
        ...r,
        tier: targets.find((t) => t.serviceId === r.serviceId)?.tier,
      })),
    });
  });

  return routes;
}
