/**
 * dev-dashboard API 통합 테스트.
 *
 * 실제 spec-core + demo-snapshot을 import하여 API 응답 구조 검증.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { createDevDashboardRoutes } from "./dev-dashboard.js";
import type { DevDkgProvider } from "../lib/dev-dkg-provider.js";

let app: Hono;
let provider: DevDkgProvider;

beforeAll(async () => {
  // 실제 spec-core에서 DKG 부트스트랩
  const analysis = await import("@qa-sdk/spec-core/analysis");
  const demoSnapshot = await import("demo-snapshot");

  const graph = (analysis as any).bootstrapDkg({ catalog: demoSnapshot.DEMO_CATALOG });
  const catalog = demoSnapshot.DEMO_CATALOG;

  provider = {
    getGraph: () => graph,
    getCatalog: () => catalog,
    getStore: () => undefined,
    collectMetrics: () => (analysis as any).collectMetrics(catalog, graph, null),
    metricsToObservations: (m: any) => (analysis as any).metricsToObservations(m),
    refresh: () => {},
    close: () => {},
  };

  app = new Hono();
  app.route("/", createDevDashboardRoutes({ provider }));
});

describe("GET /dev/api/overview", () => {
  it("노드 종류별 카운트 반환", async () => {
    const res = await app.request("/dev/api/overview");
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.nodes).toBeDefined();
    expect(data.nodes.axis).toBeGreaterThan(0);
    expect(data.nodes.prefix).toBeGreaterThan(0);
    expect(data.nodes.domain).toBeGreaterThan(0);
    expect(data.health).toBeDefined();
    expect(data.observations).toBeDefined();
    expect(typeof data.observations.total).toBe("number");
    expect(typeof data.observations.unresolved).toBe("number");
  });
});

describe("GET /dev/api/flow-map", () => {
  it("3-layer 구조 반환", async () => {
    const res = await app.request("/dev/api/flow-map");
    expect(res.status).toBe(200);

    const data = await res.json() as any;

    // layers
    expect(data.layers).toBeDefined();
    expect(data.layers.schema).toBeInstanceOf(Array);
    expect(data.layers.prefix).toBeInstanceOf(Array);
    expect(data.layers.consumer).toBeInstanceOf(Array);

    // schema layer has axes
    expect(data.layers.schema.length).toBeGreaterThan(0);
    const axis = data.layers.schema[0];
    expect(axis).toHaveProperty("id");
    expect(axis).toHaveProperty("headroom");
    expect(axis).toHaveProperty("status");

    // prefix layer
    expect(data.layers.prefix.length).toBeGreaterThan(0);
    const prefix = data.layers.prefix[0];
    expect(prefix).toHaveProperty("id");
    expect(prefix).toHaveProperty("category");
    expect(prefix).toHaveProperty("axes");

    // edges
    expect(data.edges).toBeInstanceOf(Array);

    // progress
    expect(data.progress).toBeDefined();
    expect(typeof data.progress.defined).toBe("number");
    expect(typeof data.progress.active).toBe("number");
  });
});

describe("GET /dev/api/metrics", () => {
  it("metric 요약 + 카테고리별 그룹 반환", async () => {
    const res = await app.request("/dev/api/metrics");
    expect(res.status).toBe(200);

    const data = await res.json() as any;

    // summary
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.ok).toBe("number");
    expect(typeof data.summary.total).toBe("number");
    expect(data.summary.ok + data.summary.warning + data.summary.critical).toBe(data.summary.total);

    // byCategory
    expect(data.byCategory).toBeDefined();
    expect(Object.keys(data.byCategory).length).toBeGreaterThan(0);

    // individual metrics
    expect(data.metrics).toBeInstanceOf(Array);
    expect(data.metrics.length).toBeGreaterThan(0);

    // observations count
    expect(data.observations).toBeDefined();
  });
});

describe("GET /dev/api/timeline", () => {
  it("시간순 이벤트 반환", async () => {
    const res = await app.request("/dev/api/timeline");
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.events).toBeInstanceOf(Array);
    expect(data.events.length).toBeGreaterThan(0);
    expect(typeof data.total).toBe("number");

    // 각 이벤트에 필수 필드
    for (const event of data.events) {
      expect(event).toHaveProperty("kind");
      expect(event).toHaveProperty("id");
      expect(["decision", "observation", "version-event"]).toContain(event.kind);
    }

    // 날짜 역순 정렬 확인
    for (let i = 1; i < data.events.length; i++) {
      expect(data.events[i - 1].date >= data.events[i].date).toBe(true);
    }
  });

  it("limit 파라미터 동작", async () => {
    const res = await app.request("/dev/api/timeline?limit=5");
    const data = await res.json() as any;
    expect(data.events.length).toBeLessThanOrEqual(5);
  });
});

describe("POST /dev/api/refresh", () => {
  it("캐시 무효화", async () => {
    const res = await app.request("/dev/api/refresh", { method: "POST" });
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.ok).toBe(true);
  });
});
