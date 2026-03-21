/**
 * CLI 조회 기능 테스트 — prefix 식별자로 조회.
 *
 * CLI의 encode/decode/resolve/find-version/impact를
 * 프로그래밍 방식으로 검증한다.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, encodePrefixByValue, decodePrefix, getPrefixShape, getPrefixStructure } from "demo-snapshot";
import { bootstrapDkg } from "./bootstrap.js";
import { resolve } from "./resolve.js";
import { findVersionForEntry, findRefAddress } from "./semantic-ref.js";
import { analyzeImpact } from "./skills/analyze-impact.js";
import { catalogToPrefixSpecs } from "../loader/catalog-bridge.js";

describe("CLI 조회: prefix 식별자 기반", () => {

  it("prefix 목록 조회 — category별 분류", () => {
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const specMap = new Map(specs.map(s => [s.id, s]));

    const prefixes = Object.entries(DEMO_CATALOG.prefixes).map(([id, p]) => ({
      id,
      name: p.name,
      dims: p.labels.length,
      versions: p.versions.length,
      category: specMap.get(id)?.schema?.category ?? "?",
    }));

    // category별 그룹핑
    const byCategory = new Map<string, typeof prefixes>();
    for (const p of prefixes) {
      const list = byCategory.get(p.category) ?? [];
      list.push(p);
      byCategory.set(p.category, list);
    }

    console.log("\n══ Prefix 목록 (category별) ══");
    for (const [cat, members] of byCategory) {
      console.log(`\n  [${cat}]`);
      for (const p of members) {
        console.log(`    ${p.id.padEnd(17)} ${p.name.padEnd(15)} dims=${p.dims} versions=${p.versions}`);
      }
    }

    expect(prefixes.length).toBe(34);

    // category 분류 검증
    const eventPrefixes = prefixes.filter(p => p.category === "event");
    const relationPrefixes = prefixes.filter(p => p.category === "relation");
    const observationPrefixes = prefixes.filter(p => p.category === "observation");
    const policyPrefixes = prefixes.filter(p => p.category === "policy");

    expect(eventPrefixes.length).toBeGreaterThan(0);
    expect(relationPrefixes.length).toBeGreaterThan(0);
    expect(observationPrefixes.length).toBeGreaterThan(0);
    expect(policyPrefixes.length).toBeGreaterThan(0);

    // 이벤트 prefix에는 table_ref가 있는 것들이 포함
    const eventIds = eventPrefixes.map(p => p.id);
    expect(eventIds).toContain("cart_event");
    expect(eventIds).toContain("engine_event");

    // 관계 prefix
    expect(relationPrefixes.map(p => p.id)).toContain("relational");

    // 관측 prefix
    expect(observationPrefixes.map(p => p.id)).toContain("endpoint");
    expect(observationPrefixes.map(p => p.id)).toContain("pipeline_point");
  });

  it("prefix 상세 조회 — endpoint prefix 구조", () => {
    const s = getPrefixStructure(DEMO_CATALOG, "endpoint");

    console.log("\n══ endpoint prefix 상세 ══");
    console.log(`  labels: ${s.labels.join(", ")}`);
    console.log(`  versions: ${s.versions.join(", ")}`);
    for (const [label, dim] of Object.entries(s.dims)) {
      console.log(`  ${label}: ${dim.kind}${dim.kind === "axis" ? `(${dim.axisId})` : dim.kind === "prefix_ref" ? `(→${dim.prefixId})` : ""}`);
    }

    expect(s.labels).toContain("svc_ref");
    expect(s.labels).toContain("resource_type");
    expect(s.labels).toContain("http_method");
  });

  it("encode by prefix id — endpoint:v1 인코딩", () => {
    const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const addr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
      svc_ref: svcRef,
      resource_type: "api",
      http_method: "POST",
      api_version: "v1",
    });

    console.log(`\n  endpoint encode: svc_ref=${svcRef}, type=api, method=POST, ver=v1 → ${addr}`);

    const decoded = decodePrefix(DEMO_CATALOG, "endpoint", "v1", addr);
    expect(decoded.resource_type.value).toBe("api");
    expect(decoded.http_method.value).toBe("POST");
  });

  it("decode by serialized — endpoint:v1:ADDR", () => {
    const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const addr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
      svc_ref: svcRef,
      resource_type: "webhook",
      http_method: "POST",
      api_version: "v1",
    });

    const decoded = decodePrefix(DEMO_CATALOG, "endpoint", "v1", addr);
    expect(decoded.resource_type.value).toBe("webhook");
  });

  it("resolve — 버전 자동 마이그레이션", () => {
    const svcRef = DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0];
    const addr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
      svc_ref: svcRef, page: "home", locale: "ko", userType: "member",
    });
    const serialized = `page_view:v1:${addr}`;

    const result = resolve(DEMO_CATALOG, serialized);
    // page_view가 v2가 됐으므로 v1 주소는 migration 발생
    expect(result.migrated).toBe(true);
    expect(result.values.page.value).toBe("home");
  });

  it("find-version — 축 entry 버전 검색", () => {
    // deploy_action은 v1에만
    const versions = findVersionForEntry(DEMO_CATALOG, "deploy_action", "canary_promote");
    expect(versions).toContain("v1");

    // health_status
    const hv = findVersionForEntry(DEMO_CATALOG, "health_status", "degraded");
    expect(hv).toContain("v1");
  });

  it("impact — deploy_action 축 변경 cascade", () => {
    const graph = bootstrapDkg();
    const impact = analyzeImpact(graph, {
      type: "entry-added",
      target: { axis: "deploy_action" },
    });

    console.log("\n══ deploy_action impact ══");
    console.log(`  stride-break: ${impact.strideBreak}`);
    console.log(`  영향 prefix: ${impact.affectedPrefixes.map(p => p.id).join(", ")}`);

    expect(impact.strideBreak).toBe(false);
    expect(impact.affectedPrefixes.some(p => p.id === "deploy_event")).toBe(true);
  });

  it("shape 조회 — 신규 prefix들", () => {
    console.log("\n══ 신규 prefix shape ══");
    for (const id of ["endpoint", "page_view", "flow_point", "deploy_event", "health_event"]) {
      const prefix = DEMO_CATALOG.prefixes[id as keyof typeof DEMO_CATALOG.prefixes];
      const latestV = prefix.versions[prefix.versions.length - 1].version;
      const shape = getPrefixShape(DEMO_CATALOG, id, latestV);
      console.log(`  ${id.padEnd(15)} shape=[${shape.shape.join(",")}] cap=${shape.capacity}`);
    }
  });
});
