// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Phase 3: 좌표계 시나리오 검증.
 *
 * DEMO_CATALOG의 실제 prefix로 end-to-end 파이프라인을 증명한다:
 *   decode(address) → entries lookup → export resolve
 *
 * "작은 세계 구체화"의 핵심 흐름.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { DEMO_CATALOG, decodePrefix, encodePrefixByValue, resolveAddress } from "demo-snapshot";
import {
  ExportSurfaceRegistry,
  catalogToPrefixSpecs,
  type PrefixSpec,
} from "./index.js";

let prefixSpecs: PrefixSpec[];
let surfaces: ExportSurfaceRegistry;

beforeAll(() => {
  prefixSpecs = catalogToPrefixSpecs(DEMO_CATALOG);
  surfaces = new ExportSurfaceRegistry();
  for (const spec of prefixSpecs) {
    surfaces.register(spec.id, spec.export);
  }
});

// ── 시나리오 1: service prefix (all axis, 4차원) ────────────────

describe("시나리오 1: service prefix", () => {
  it("모든 DEMO_CATALOG prefix가 PrefixSpec으로 변환된다", () => {
    const catalogPrefixIds = Object.keys(DEMO_CATALOG.prefixes);
    expect(prefixSpecs.length).toBe(catalogPrefixIds.length);

    for (const id of catalogPrefixIds) {
      expect(prefixSpecs.find(s => s.id === id)).toBeDefined();
    }
  });

  it("service: decode → values → export resolve", () => {
    // service:v1 — env × region × svc_name × namespace
    // address 0 = [0,0,0,0] = dev, asia, shopping-web, shop
    const decoded = decodePrefix(DEMO_CATALOG, "service", "v1", 0);

    // entries lookup → 값 추출
    const values: Record<string, string> = {};
    for (const [label, dim] of Object.entries(decoded)) {
      values[label] = String(dim.value);
    }

    // export resolve
    const title = surfaces.resolve("service", values);
    expect(title).toBe("dev.asia.shopping-web.shop");
  });

  it("service: prod 환경 encode → decode 라운드트립", () => {
    // capacity 변경에 독립적인 테스트: 문자열 기반 라운드트립
    const addr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });

    const decoded = decodePrefix(DEMO_CATALOG, "service", "v1", addr);
    expect(decoded.env.value).toBe("prod");
    expect(decoded.region.value).toBe("asia");

    const values: Record<string, string> = {};
    for (const [label, dim] of Object.entries(decoded)) {
      values[label] = String(dim.value);
    }
    const title = surfaces.resolve("service", values);
    expect(title).toContain("prod");
  });
});

// ── 시나리오 2: cart_event prefix (table_ref 제외) ──────────────

describe("시나리오 2: cart_event prefix", () => {
  it("cart_event export surface에 table_ref가 제외됨", () => {
    const spec = prefixSpecs.find(s => s.id === "cart_event")!;

    // actor(table_ref), target(table_ref) 제외. svc_ref는 prefix_ref이므로 포함 가능.
    // SSOT: export dims는 카탈로그 구조에서 파생
    for (const dim of spec.export.dims) {
      expect(dim).not.toBe("actor");
      expect(dim).not.toBe("target");
    }
    expect(spec.export.dims).toContain("action");
  });

  it("cart_event: decode → export surface로 해석 가능", () => {
    const spec = prefixSpecs.find(s => s.id === "cart_event")!;
    const decoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", 0);

    // export dims에 해당하는 값을 모두 추출하여 resolve
    const values: Record<string, string> = {};
    for (const dim of spec.export.dims) {
      const d = decoded[dim];
      if (d) values[dim] = String(d.value);
    }
    const title = surfaces.resolve("cart_event", values);
    expect(typeof title).toBe("string");
    expect(title.length).toBeGreaterThan(0);
  });

  it("cart_event: 각 action position이 올바른 title을 생성", () => {
    const spec = prefixSpecs.find(s => s.id === "cart_event")!;
    const actions = ["add", "remove", "checkout"];
    for (let i = 0; i < actions.length; i++) {
      const decoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", i);
      const values: Record<string, string> = {};
      for (const dim of spec.export.dims) {
        const d = decoded[dim];
        if (d) values[dim] = String(d.value);
      }
      const title = surfaces.resolve("cart_event", values);
      expect(title).toContain(actions[i]);
    }
  });
});

// ── 시나리오 3: permission prefix (prefix_ref + axis) ───────────

describe("시나리오 3: permission prefix (prefix_ref)", () => {
  it("permission export에 prefix_ref(perm_svc) + axis(role) 포함", () => {
    const spec = prefixSpecs.find(s => s.id === "permission")!;

    expect(spec.export.dims).toEqual(["perm_svc", "role"]);
    expect(spec.imports).toEqual({ perm_svc: "service" });
  });

  it("permission: decode → values → export resolve", () => {
    // permission:v1 — perm_svc(prefix_ref→service) × role(axis)
    // decode하면 perm_svc는 참조된 service prefix의 주소(정수)
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v1", 0);

    const values: Record<string, string> = {};
    for (const [label, dim] of Object.entries(decoded)) {
      values[label] = String(dim.value);
    }

    const title = surfaces.resolve("permission", values);
    // perm_svc는 service 주소(정수), role은 entry string
    expect(title).toContain(".");
    expect(typeof decoded.role.value).toBe("string");
  });

  it("permission: prefix_ref를 resolveAddress로 깊게 분해 가능", () => {
    // permission:v1:3 → resolveAddress로 전체 트리 분해
    const resolved = resolveAddress(DEMO_CATALOG, "permission", "v1", 3);

    // role은 직접 값
    expect(resolved.dims.role).toBeDefined();
    expect(typeof resolved.dims.role.value).toBe("string");

    // perm_svc는 prefix_ref → service prefix를 재귀 resolve
    expect(resolved.dims.perm_svc.ref).toBeDefined();
    const serviceRef = resolved.dims.perm_svc.ref!;
    expect(serviceRef.prefix).toBe("service");
    // service의 하위 차원이 분해됨
    expect(serviceRef.dims.env).toBeDefined();
    expect(serviceRef.dims.svc_name).toBeDefined();
  });

  it("3단계 해상도 — key → title → decompose → deep resolve", () => {
    // key: permission:v1:3
    const address = 3;

    // 1단계: export title (표면)
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v1", address);
    const values: Record<string, string> = {};
    for (const [label, dim] of Object.entries(decoded)) {
      values[label] = String(dim.value);
    }
    const title = surfaces.resolve("permission", values);
    expect(typeof title).toBe("string");
    expect(title.length).toBeGreaterThan(0);

    // 2단계: 내부 분해 (entries lookup)
    expect(decoded.perm_svc).toBeDefined();
    expect(decoded.role).toBeDefined();

    // 3단계: 깊은 관측 (resolveAddress)
    const resolved = resolveAddress(DEMO_CATALOG, "permission", "v1", address);
    expect(resolved.dims.perm_svc.ref!.dims.env.value).toBeDefined();
  });
});

// ── 시나리오 4: order_event (prefix_ref + axis + table_ref) ─────

describe("시나리오 4: order_event prefix (혼합)", () => {
  it("order_event: prefix_ref + axis만 export, table_ref 제외", () => {
    const spec = prefixSpecs.find(s => s.id === "order_event")!;

    // service_ctx(prefix_ref) + action(axis) — export
    // actor(table_ref) + order(table_ref) — 제외
    expect(spec.export.dims).toEqual(["service_ctx", "action"]);
    expect(spec.imports).toEqual({ service_ctx: "service" });
  });

  it("order_event: decode → export title", () => {
    const decoded = decodePrefix(DEMO_CATALOG, "order_event", "v1", 0);
    const values: Record<string, string> = {};
    for (const [label, dim] of Object.entries(decoded)) {
      values[label] = String(dim.value);
    }

    const title = surfaces.resolve("order_event", values);
    expect(typeof title).toBe("string");
    // service_ctx(정수).action(문자열)
    expect(title).toContain(".");
  });
});

// ── 전체 prefix 라운드트립 ──────────────────────────────────────

describe("전체 DEMO_CATALOG prefix export surface 검증", () => {
  it("모든 prefix가 ExportSurfaceRegistry에 등록됨", () => {
    const catalogPrefixIds = Object.keys(DEMO_CATALOG.prefixes);
    for (const id of catalogPrefixIds) {
      expect(surfaces.has(id)).toBe(true);
    }
  });

  it("모든 prefix의 address 0에서 export resolve가 동작", () => {
    for (const spec of prefixSpecs) {
      const decoded = decodePrefix(DEMO_CATALOG, spec.id, spec.version, 0);
      const values: Record<string, string> = {};
      for (const [label, dim] of Object.entries(decoded)) {
        values[label] = String(dim.value);
      }

      // export dims에 대한 값만 필요
      const exportValues: Record<string, string> = {};
      for (const dim of spec.export.dims) {
        exportValues[dim] = values[dim];
      }

      const title = surfaces.resolve(spec.id, exportValues);
      expect(typeof title).toBe("string");
      expect(title.length).toBeGreaterThan(0);
    }
  });
});
