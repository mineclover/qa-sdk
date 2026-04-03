import { describe, expect, it, vi, beforeEach } from "vitest";
import { bootstrapDkg } from "../bootstrap.js";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { serviceHealthCheck, eventCoverageCheck } from "./service-skills.js";

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

describe("serviceHealthCheck", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("healthy 상태를 올바르게 파싱", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "healthy",
        up: 5,
        down: 0,
        total: 5,
        services: [
          { serviceId: "registry", status: "up" },
          { serviceId: "ingest", status: "up" },
          { serviceId: "gate", status: "up" },
          { serviceId: "query", status: "up" },
          { serviceId: "decode", status: "up" },
        ],
      })),
    );

    const result = await serviceHealthCheck("http://test:3300");
    expect(result.status).toBe("healthy");
    expect(result.up).toBe(5);
    expect(result.down).toBe(0);
    expect(result.downServices).toEqual([]);
    expect(result.observations).toHaveLength(0);
  });

  it("degraded 상태에서 다운 서비스 observation 생성", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "degraded",
        up: 3,
        down: 2,
        total: 5,
        services: [
          { serviceId: "registry", status: "up" },
          { serviceId: "ingest", status: "down", error: "fetch failed" },
          { serviceId: "gate", status: "up" },
          { serviceId: "query", status: "down", error: "HTTP 500" },
          { serviceId: "decode", status: "up" },
        ],
      })),
    );

    const result = await serviceHealthCheck("http://test:3300");
    expect(result.status).toBe("degraded");
    expect(result.downServices).toEqual(["ingest", "query"]);
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0].id).toBe("OBS-SVC-DOWN-ingest");
    expect(result.observations[0].intent).toBe("action-needed");
  });
});

describe("eventCoverageCheck", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("수집된 prefix와 정의된 prefix를 비교", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([
        { prefix: "service", count: 10 },
        { prefix: "page_view", count: 5 },
        { prefix: "cart_event", count: 3 },
      ])),
    );

    const result = await eventCoverageCheck("http://test:3200", graph);
    expect(result.definedPrefixes).toBeGreaterThan(30);
    expect(result.observedPrefixes).toBe(3);
    expect(result.coveragePercent).toBeLessThan(20);
    expect(result.unobserved.length).toBe(result.definedPrefixes - 3);
    // 커버리지 낮으므로 observation 생성
    expect(result.observations.length).toBeGreaterThan(0);
  });

  it("핵심 prefix 미관측 시 개별 observation 생성", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([
        { prefix: "service", count: 10 },
      ])),
    );

    const result = await eventCoverageCheck("http://test:3200", graph);
    // page_view, tracking, auth_event, order_event는 미관측 → 개별 observation
    const idleObs = result.observations.filter(o => o.id.startsWith("OBS-PREFIX-IDLE-"));
    expect(idleObs.length).toBeGreaterThanOrEqual(3); // page_view, tracking, auth_event, order_event 중 정의된 것
  });
});
