import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { bootstrapDkg, type GraphRegistry } from "@qa-sdk/spec-core/dkg";
import { collectMetrics } from "@qa-sdk/spec-core/convergence";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { createDashboardApiRoutes } from "./dashboard-api.js";

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG }) as GraphRegistry;

function buildApp() {
  const app = new Hono();
  app.route("/", createDashboardApiRoutes({
    getGraph: () => graph as any,
    getCatalog: () => DEMO_CATALOG as any,
    collectMetrics: () => collectMetrics(DEMO_CATALOG as any, graph as any, null) as any,
  }));
  return app;
}

describe("dashboard-api", () => {
  const app = buildApp();

  it("GET /overview — DKG 노드 요약", async () => {
    const res = await app.request("/overview");
    expect(res.status).toBe(200);
    const d = await res.json() as any;
    expect(d.nodes).toBeTruthy();
    expect(d.total.nodes).toBeGreaterThan(100);
    expect(d.total.edges).toBeGreaterThan(0);
    expect(d.health).toBeTruthy();
    expect(d.observations).toBeTruthy();
  });

  it("GET /flow-map — 3-layer 구조", async () => {
    const res = await app.request("/flow-map");
    expect(res.status).toBe(200);
    const d = await res.json() as any;
    const layers = d.layers;
    expect(layers.schema.length).toBe(Object.keys(DEMO_CATALOG.axes).length);
    expect(layers.prefix.length).toBeGreaterThan(30);
    expect(layers.consumer.length).toBeGreaterThan(0);
    expect(d.edges.length).toBeGreaterThan(0);
    expect(d.progress.defined).toBeGreaterThan(0);
    expect(d.progress.active).toBe(d.progress.defined);
  });

  it("GET /metrics — DKG 메트릭 집계", async () => {
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    const d = await res.json() as any;
    expect(d.summary.total).toBeGreaterThan(0);
    expect(d.metrics.length).toBe(d.summary.total);
    expect(d.byCategory).toBeTruthy();
    expect(d.observations).toBeTruthy();
  });

  it("GET /timeline — 의사결정/관측 이벤트", async () => {
    const res = await app.request("/timeline");
    expect(res.status).toBe(200);
    const d = await res.json() as any;
    expect(d.total).toBeGreaterThan(0);
    expect(d.events.length).toBeLessThanOrEqual(30);
    // 각 이벤트에 kind, id, date 필드
    for (const e of d.events) {
      expect(e.kind).toBeTruthy();
      expect(e.id).toBeTruthy();
    }
  });
});
