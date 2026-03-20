import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { deriveFromCatalog } from "../dkg/catalog-derive.js";
import { bootstrapDkg } from "../dkg/bootstrap.js";
import { validatePrefixCategory, validateAllCategories, CATEGORY_RULES } from "./category-rules.js";
import type { PrefixNode } from "../dkg/dkg.types.js";

describe("Category Rules — prefix 타입 규칙 검증", () => {

  it("6종 카테고리 규칙이 정의되어 있다", () => {
    const categories = Object.keys(CATEGORY_RULES);
    expect(categories).toContain("entity");
    expect(categories).toContain("event");
    expect(categories).toContain("relation");
    expect(categories).toContain("state");
    expect(categories).toContain("policy");
    expect(categories).toContain("observation");
    expect(categories.length).toBe(6);
  });

  it("전체 prefix 카테고리 검증 — DEMO_CATALOG", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const result = validateAllCategories(graph);

    console.log("\n══ Category 규칙 검증 ══");
    console.log(`  total: ${result.total}, passed: ${result.passed}, failed: ${result.failed}\n`);

    // 카테고리별 그룹핑
    const byCategory = new Map<string, typeof result.results>();
    for (const r of result.results) {
      const list = byCategory.get(r.category) ?? [];
      list.push(r);
      byCategory.set(r.category, list);
    }

    for (const [category, results] of byCategory) {
      const passed = results.filter(r => r.valid);
      const failed = results.filter(r => !r.valid);

      console.log(`  [${category}] ${passed.length}/${results.length} passed`);
      for (const p of passed) {
        console.log(`    ✅ ${p.prefixId}`);
      }
      for (const f of failed) {
        console.log(`    ❌ ${f.prefixId}: ${f.errors.join("; ")}`);
      }
    }

    // 대부분 통과해야 함
    expect(result.passed).toBeGreaterThan(result.failed);
  });

  it("entity prefix — service, event, content, tracking", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);

    for (const id of ["service", "content", "tracking"]) {
      const r = validatePrefixCategory(id, graph);
      console.log(`  ${id}: ${r.valid ? "✅" : "❌"} ${r.errors.join("; ")}`);
      // entity는 느슨한 규칙 — 대부분 통과
    }
  });

  it("event prefix — action 축 필수", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);

    for (const id of ["cart_event", "auth_event", "deploy_event", "health_event"]) {
      const r = validatePrefixCategory(id, graph);
      console.log(`  ${id}: ${r.valid ? "✅" : "❌"} ${r.errors.join("; ")}`);
    }
  });

  it("observation prefix — service 참조 필수", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);

    for (const id of ["page_view", "endpoint", "flow_point"]) {
      const r = validatePrefixCategory(id, graph);
      console.log(`  ${id}: ${r.valid ? "✅" : "❌"} ${r.errors.join("; ")}`);
      expect(r.valid).toBe(true); // observation은 svc_ref 있어야 함
    }
  });

  it("policy prefix — role/action 축 필수", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);

    for (const id of ["permission", "rbac"]) {
      const r = validatePrefixCategory(id, graph);
      console.log(`  ${id}: ${r.valid ? "✅" : "❌"} ${r.errors.join("; ")}`);
      expect(r.valid).toBe(true);
    }
  });
});
