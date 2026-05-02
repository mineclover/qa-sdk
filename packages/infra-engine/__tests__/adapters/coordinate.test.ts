import { describe, it, expect } from "vitest";
import { createCoordinateAdapter } from "../../src/adapters/coordinate.js";
import type { Catalog } from "@qa-sdk/core";

/** 테스트용 미니 catalog — DEMO_CATALOG 구조의 축소판 */
const MINI_CATALOG: Catalog = {
  id: "test",
  name: "test",
  axes: {
    env: { id: "env", name: "env", versions: { v1: { entries: ["dev", "stage", "prod"], capacity: 4 } } },
    region: { id: "region", name: "region", versions: { v1: { entries: ["asia", "usa"], capacity: 4 } } },
    svc_name: { id: "svc_name", name: "svc_name", versions: { v1: { entries: ["web", "api", "auth"], capacity: 4 } } },
    namespace: { id: "namespace", name: "namespace", versions: { v1: { entries: ["shop", "cms"], capacity: 4 } } },
    deploy_action: { id: "deploy_action", name: "deploy_action", versions: { v1: { entries: ["deploy", "rollback", "scale_up"], capacity: 4 } } },
    health_status: { id: "health_status", name: "health_status", versions: { v1: { entries: ["healthy", "degraded", "unhealthy"], capacity: 4 } } },
  },
  prefixes: {
    service: {
      id: "service", name: "서비스",
      description: "",
      labels: ["env", "region", "svc_name", "namespace"],
      dims: {
        env: { kind: "axis", axisId: "env" },
        region: { kind: "axis", axisId: "region" },
        svc_name: { kind: "axis", axisId: "svc_name" },
        namespace: { kind: "axis", axisId: "namespace" },
      },
      meta: {},
      versions: [{ version: "v1", axisVersions: { env: "v1", region: "v1", svc_name: "v1", namespace: "v1" } }],
    },
    deploy_event: {
      id: "deploy_event", name: "배포 이벤트",
      description: "",
      labels: ["svc_ref", "deploy_action", "actor"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        deploy_action: { kind: "axis", axisId: "deploy_action" },
        actor: { kind: "table_ref", table: "members" },
      },
      meta: {},
      versions: [{
        version: "v1",
        axisVersions: { deploy_action: "v1" },
        refEntries: { svc_ref: { values: [0, 1, 2], refVersion: "v1" } },
      }],
    },
    health_event: {
      id: "health_event", name: "헬스 이벤트",
      description: "",
      labels: ["svc_ref", "health_status"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        health_status: { kind: "axis", axisId: "health_status" },
      },
      meta: {},
      versions: [{
        version: "v1",
        axisVersions: { health_status: "v1" },
        refEntries: { svc_ref: { values: [0, 1, 2], refVersion: "v1" } },
      }],
    },
  },
} as unknown as Catalog;

describe("CoordinateAdapter", () => {
  const coord = createCoordinateAdapter(MINI_CATALOG);

  // service prefix: env(4) × region(4) × svc_name(4) × namespace(4)
  // strides: [64, 16, 4, 1]
  // dev=0, asia=0, web=0, shop=0 → address = 0
  // dev=0, asia=0, api=1, shop=0 → address = 4

  it("resolveSvcRef — 정상 인코딩", () => {
    const result = coord.resolveSvcRef("web", "dev", "asia", "shop");
    expect(result).toMatch(/^service:v1:\d+$/);
    expect(result).toBe("service:v1:0");
  });

  it("resolveSvcRef — 다른 좌표", () => {
    const result = coord.resolveSvcRef("api", "dev", "asia", "shop");
    expect(result).toBe("service:v1:4");
  });

  it("resolveSvcRef — namespace 기본값 shop", () => {
    const result = coord.resolveSvcRef("web", "dev", "asia");
    expect(result).toBe("service:v1:0");
  });

  it("resolveSvcRef — 미등록 서비스 → null", () => {
    expect(coord.resolveSvcRef("unknown-svc", "dev", "asia")).toBeNull();
  });

  it("resolveSvcRef — 미등록 env → null", () => {
    expect(coord.resolveSvcRef("web", "unknown-env", "asia")).toBeNull();
  });

  it("encodeDeployEvent — null svcRef → {}", () => {
    expect(coord.encodeDeployEvent(null, "deploy")).toEqual({});
  });

  it("encodeDeployEvent — 정상 인코딩", () => {
    const result = coord.encodeDeployEvent("service:v1:0", "deploy");
    expect(result).toHaveProperty("deploy_event");
    expect(result.deploy_event).toMatch(/^deploy_event:v1:\d+$/);
  });

  it("encodeDeployEvent — rollback 액션", () => {
    const result = coord.encodeDeployEvent("service:v1:0", "rollback");
    expect(result.deploy_event).toBe("deploy_event:v1:1");
  });

  it("encodeDeployEvent — 미등록 action → {}", () => {
    expect(coord.encodeDeployEvent("service:v1:0", "unknown_action")).toEqual({});
  });

  it("encodeDeployEvent — svcRef가 refEntries에 없으면 → {}", () => {
    expect(coord.encodeDeployEvent("service:v1:999", "deploy")).toEqual({});
  });

  it("encodeHealthEvent — null svcRef → {}", () => {
    expect(coord.encodeHealthEvent(null, "healthy")).toEqual({});
  });

  it("encodeHealthEvent — 정상 인코딩", () => {
    const result = coord.encodeHealthEvent("service:v1:0", "healthy");
    expect(result).toHaveProperty("health_event");
    expect(result.health_event).toBe("health_event:v1:0");
  });

  it("encodeHealthEvent — degraded 상태", () => {
    const result = coord.encodeHealthEvent("service:v1:0", "degraded");
    expect(result.health_event).toBe("health_event:v1:1");
  });

  it("encodeHealthEvent — 미등록 status → {}", () => {
    expect(coord.encodeHealthEvent("service:v1:0", "unknown_status")).toEqual({});
  });
});

describe("CoordinateAdapter — empty catalog (fail-open)", () => {
  const emptyCatalog = { id: "empty", name: "empty", axes: {}, prefixes: {} } as unknown as Catalog;
  const coord = createCoordinateAdapter(emptyCatalog);

  it("resolveSvcRef → null", () => {
    expect(coord.resolveSvcRef("web", "dev", "asia")).toBeNull();
  });

  it("encodeDeployEvent → {}", () => {
    expect(coord.encodeDeployEvent("service:v1:0", "deploy")).toEqual({});
  });

  it("encodeHealthEvent → {}", () => {
    expect(coord.encodeHealthEvent("service:v1:0", "healthy")).toEqual({});
  });
});
