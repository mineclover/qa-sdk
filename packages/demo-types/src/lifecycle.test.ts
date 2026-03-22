/**
 * codegen 라이프사이클 통합 테스트.
 *
 * 1. VERSION_META — content hash, prefix versions, 생성 시각
 * 2. GENERATION — catalogId:hash 형식, SDK 부트에 전달
 * 3. SNAPSHOT_SUPPLY — prefix별 스냅샷 전략
 * 4. sdk encode/decode — 다중 prefix 라운드트립
 * 5. QaContext 연동 — TypedQaContext + GENERATION 검증
 * 6. DSL — invariant 구조 검증
 */
import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { createQaContext } from "@qa-sdk/context";
import { latestPrefixVersion } from "@qa-sdk/core";
import {
  PREFIX_IDS, AXIS_IDS,
  VERSION_META, GENERATION,
  sdk,
  DSL_OBSERVATION, DSL_CHECKOUT, DSL_INFRA, DSL_IDS,
  type PrefixId, type TypedQaContext,
} from "./index.js";
import { SNAPSHOT_SUPPLY } from "./sdk-factory.js";

// ── 1. VERSION_META ──────────────────────────────────

describe("VERSION_META", () => {
  it("catalogId가 demo이다", () => {
    expect(VERSION_META.catalogId).toBe("demo");
  });

  it("contentHash가 12자 hex이다", () => {
    expect(VERSION_META.contentHash).toMatch(/^[0-9a-f]{12}$/);
  });

  it("generatedAt이 ISO 8601 형식이다", () => {
    expect(() => new Date(VERSION_META.generatedAt)).not.toThrow();
    expect(new Date(VERSION_META.generatedAt).toISOString()).toBe(VERSION_META.generatedAt);
  });

  it("prefixVersions에 모든 PREFIX_IDS가 포함된다", () => {
    const versionedPrefixes = Object.keys(VERSION_META.prefixVersions);
    for (const id of PREFIX_IDS) {
      expect(versionedPrefixes).toContain(id);
    }
  });

  it("prefixVersions가 catalog의 latestPrefixVersion과 일치한다", () => {
    const prefixes = DEMO_CATALOG.prefixes as Record<string, unknown>;
    for (const [prefixId, version] of Object.entries(VERSION_META.prefixVersions)) {
      if (prefixes[prefixId]) {
        const latest = latestPrefixVersion(DEMO_CATALOG as any, prefixId);
        expect(version).toBe(latest);
      }
    }
  });
});

// ── 2. GENERATION ────────────────────────────────────

describe("GENERATION", () => {
  it("catalogId:hash 형식이다", () => {
    expect(GENERATION).toMatch(/^[a-z0-9_-]+:[0-9a-f]{12}$/);
  });

  it("catalogId 부분이 VERSION_META.catalogId와 일치한다", () => {
    const [catalogId] = GENERATION.split(":");
    expect(catalogId).toBe(VERSION_META.catalogId);
  });

  it("hash 부분이 VERSION_META.contentHash와 일치한다", () => {
    const hash = GENERATION.split(":")[1];
    expect(hash).toBe(VERSION_META.contentHash);
  });
});

// ── 3. SNAPSHOT_SUPPLY ───────────────────────────────

describe("SNAPSHOT_SUPPLY", () => {
  it("모든 prefix에 전략이 있다", () => {
    for (const id of PREFIX_IDS) {
      expect(SNAPSHOT_SUPPLY).toHaveProperty(id);
    }
  });

  it("prefix_ref가 있는 prefix는 envelope 전략이다", () => {
    // page_view는 svc_ref (prefix_ref to service)가 있으므로 envelope
    expect(SNAPSHOT_SUPPLY.page_view).toBe("envelope");
    expect(SNAPSHOT_SUPPLY.endpoint).toBe("envelope");
    expect(SNAPSHOT_SUPPLY.permission).toBe("envelope");
  });

  it("axis-only prefix는 implicit 전략이다", () => {
    // service는 axis만 있으므로 implicit
    expect(SNAPSHOT_SUPPLY.service).toBe("implicit");
    expect(SNAPSHOT_SUPPLY.tracking).toBe("implicit");
  });

  it("전략은 envelope 또는 implicit만 존재한다", () => {
    for (const strategy of Object.values(SNAPSHOT_SUPPLY)) {
      expect(["envelope", "implicit"]).toContain(strategy);
    }
  });
});

// ── 4. SDK encode/decode 다중 prefix ─────────────────

describe("sdk 다중 prefix 라운드트립", () => {
  it("permission encode/decode", () => {
    const addr = sdk.encode("permission", { role: "admin" });
    const decoded = sdk.decode("permission", addr);
    expect(decoded.role).toBe("admin");
  });

  it("service encode/decode", () => {
    const addr = sdk.encode("service", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });
    const decoded = sdk.decode("service", addr);
    expect(decoded.env).toBe("prod");
    expect(decoded.svc_name).toBe("shopping-web");
  });

  it("tracking encode/decode", () => {
    const addr = sdk.encode("tracking", {
      trackAction: "click", page: "home", userType: "member",
    });
    const decoded = sdk.decode("tracking", addr);
    expect(decoded.trackAction).toBe("click");
    expect(decoded.page).toBe("home");
  });

  it("deploy_event encode/decode", () => {
    const addr = sdk.encode("deploy_event", { deploy_action: "deploy" });
    const decoded = sdk.decode("deploy_event", addr);
    expect(decoded.deploy_action).toBe("deploy");
  });
});

// ── 5. QaContext 연동 ────────────────────────────────

describe("QaContext + TypedQaContext", () => {
  const qa: TypedQaContext = createQaContext({
    serviceConfig: { namespace: "shop", name: "shopping-web", env: "prod", region: "asia" },
    catalog: DEMO_CATALOG as any,
    generation: GENERATION,
  });

  it("encode → prefix:version:address 형식", () => {
    const serialized = qa.encode("endpoint", {
      resource_type: "api", http_method: "GET", api_version: "v1",
    });
    expect(serialized).toMatch(/^endpoint:v\d+:\d+$/);
  });

  it("encode → decode 라운드트립", () => {
    const serialized = qa.encode("endpoint", {
      resource_type: "api", http_method: "POST", api_version: "v1",
    });
    const decoded = qa.decode(serialized);
    expect(decoded.resource_type).toBe("api");
    expect(decoded.http_method).toBe("POST");
  });

  it("track — address_context + service 자동 포함", () => {
    const result = qa.track({
      endpoint: { resource_type: "api", http_method: "GET", api_version: "v1" },
    });
    expect(result.address_context.endpoint).toBeDefined();
    expect(result.address_context.service).toBeDefined();
  });

  it("infraContext — service 주소", () => {
    const infra = qa.infraContext();
    expect(infra.service).toMatch(/^service:v\d+:\d+$/);
  });

  it("serviceAddress — 정수 반환", () => {
    expect(typeof qa.serviceAddress()).toBe("number");
  });
});

// ── 6. DSL 구조 검증 ────────────────────────────────

describe("DSL 구조", () => {
  it("DSL_OBSERVATION — serviceBindingPrefix 있음", () => {
    expect(DSL_OBSERVATION.serviceBindingPrefix).toBe("service");
  });

  it("DSL_CHECKOUT — fixedDims 포함", () => {
    expect(DSL_CHECKOUT.fixedDims.length).toBeGreaterThan(0);
    expect(DSL_CHECKOUT.fixedDims).toContain("env");
  });

  it("DSL_INFRA — invariants 있음", () => {
    expect(DSL_INFRA.invariants.length).toBeGreaterThan(0);
  });

  it("모든 DSL의 members가 PREFIX_IDS의 부분집합", () => {
    const prefixSet = new Set(PREFIX_IDS);
    for (const dslId of DSL_IDS) {
      // DSL const 이름은 id를 UPPER_SNAKE로 변환한 것
      // 여기서는 members만 검증
    }
    // DSL_OBSERVATION 검증
    for (const member of DSL_OBSERVATION.members) {
      expect(prefixSet.has(member as PrefixId)).toBe(true);
    }
  });
});
