// @def.doc definition-catalog-spec

import { describe, it, expect } from "vitest";
import { ScopeRegistry } from "./scope-registry.js";
import { DEF_SCOPE, DEF_ASPECT, DEF_DEPTH } from "./vocabulary.js";
import { VALID_SCOPE_ASPECTS } from "./taxonomy.js";

describe("ScopeRegistry", () => {
  it("초기화 시 VALID_SCOPE_ASPECTS에서 v1 구성을 파생한다", () => {
    const reg = new ScopeRegistry();

    for (const scopeId of DEF_SCOPE.entries) {
      const v = reg.getLatestVersion(scopeId as any);
      expect(v.version).toBe("v1");
      expect(v.consumes).toEqual([...VALID_SCOPE_ASPECTS[scopeId as keyof typeof VALID_SCOPE_ASPECTS]]);
    }
  });

  it("scope 인덱스가 1-based로 부여된다", () => {
    const reg = new ScopeRegistry();
    expect(reg.getScopeIndex("ui")).toBe(1);
    expect(reg.getScopeIndex("feature")).toBe(2);
    expect(reg.getScopeIndex("interface")).toBe(7);
    expect(reg.getScopeIndex("meta")).toBe(8);
  });

  describe("경로 모델 인코딩", () => {
    it("전체 주소 공간이 전곱보다 작다", () => {
      const reg = new ScopeRegistry();
      const stats = reg.stats();

      // 경로 모델: N aspect × 4 depth (SSOT에서 파생)
      const expectedTotal = DEF_ASPECT.entries.length * DEF_DEPTH.entries.length;
      expect(stats.totalAddressSpace).toBe(expectedTotal);
      // 전곱: 16 × 64 × 8 = 8,192
      expect(stats.crossProductSpace).toBe(8192);
      // 효율: 88/8192 ≈ 1%
      expect(stats.efficiency).toBeLessThan(0.02);
    });

    it("encode → decode 라운드트립", () => {
      const reg = new ScopeRegistry();

      const addr = reg.encode("ui", "layout", "specification");
      const decoded = reg.decode(addr.globalAddress);

      expect(decoded.scope).toBe("ui");
      expect(decoded.aspect).toBe("layout");
      expect(decoded.depth).toBe("specification");
    });

    it("모든 유효 조합이 인코딩/디코딩된다", () => {
      const reg = new ScopeRegistry();

      for (const [scope, aspects] of Object.entries(VALID_SCOPE_ASPECTS)) {
        for (const aspect of aspects) {
          for (const depth of DEF_DEPTH.entries) {
            const addr = reg.encode(scope as any, aspect as any, depth as any);
            const decoded = reg.decode(addr.globalAddress);

            expect(decoded.scope).toBe(scope);
            expect(decoded.aspect).toBe(aspect);
            expect(decoded.depth).toBe(depth);
          }
        }
      }
    });

    it("scope별 주소 범위가 겹치지 않는다", () => {
      const reg = new ScopeRegistry();
      const ranges: { scope: string; start: number; end: number }[] = [];

      for (const scopeId of DEF_SCOPE.entries) {
        const range = reg.getAddressRange(scopeId as any);
        ranges.push({ scope: scopeId, ...range });
      }

      // 정렬 후 겹침 확인
      ranges.sort((a, b) => a.start - b.start);
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i].start).toBeGreaterThan(ranges[i - 1].end);
      }
    });

    it("무효 scope-aspect 조합은 에러", () => {
      const reg = new ScopeRegistry();
      expect(() => reg.encode("ui", "func_def", "overview")).toThrow();
    });
  });

  describe("직렬화", () => {
    it("serialize → parse 라운드트립", () => {
      const reg = new ScopeRegistry();
      const addr = reg.encode("data", "domain_data", "overview");
      const serialized = reg.serialize(addr);

      expect(serialized).toMatch(/^scope:\d+:v\d+:\d+$/);

      const parsed = reg.parse(serialized);
      expect(parsed).not.toBeNull();
      expect(parsed!.globalAddress).toBe(addr.globalAddress);
    });
  });

  describe("버전 관리", () => {
    it("scope에 새 버전을 추가하면 소비 aspect가 변경된다", () => {
      const reg = new ScopeRegistry();

      // flow에 scenario 추가
      reg.addVersion("flow", {
        version: "v2",
        consumes: ["user_scenario", "process_flow", "relation", "scenario"],
        changelog: "scenario 소비 추가",
      });

      const v2 = reg.getLatestVersion("flow");
      expect(v2.version).toBe("v2");
      expect(v2.consumes).toContain("scenario");
      expect(v2.consumes.length).toBe(4);
    });

    it("버전 추가 후 주소 공간이 확장된다", () => {
      const reg = new ScopeRegistry();
      const beforeSize = reg.totalAddressSpace();

      reg.addVersion("flow", {
        version: "v2",
        consumes: ["user_scenario", "process_flow", "relation", "scenario"],
      });

      const afterSize = reg.totalAddressSpace();
      // flow: 3×4=12 → 4×4=16, 차이 = 4
      expect(afterSize).toBe(beforeSize + 4);
    });

    it("중복 버전은 에러", () => {
      const reg = new ScopeRegistry();
      expect(() =>
        reg.addVersion("ui", {
          version: "v1",
          consumes: ["layout", "component", "interaction"],
        }),
      ).toThrow("이미 존재");
    });

    it("pool에 없는 aspect 소비는 에러", () => {
      const reg = new ScopeRegistry();
      expect(() =>
        reg.addVersion("ui", {
          version: "v2",
          consumes: ["layout", "nonexistent_aspect" as any],
        }),
      ).toThrow("pool에 없음");
    });
  });

  describe("N:M 소비 조회", () => {
    it("현재 v1에서 각 aspect는 1개 scope에서만 소비된다", () => {
      const reg = new ScopeRegistry();

      for (const aspect of DEF_ASPECT.entries) {
        const scopes = reg.getScopesConsuming(aspect as any);
        expect(scopes.length).toBe(1);
      }
    });

    it("N:M 추가 후 같은 aspect가 여러 scope에서 소비된다", () => {
      const reg = new ScopeRegistry();

      reg.addVersion("flow", {
        version: "v2",
        consumes: ["user_scenario", "process_flow", "relation", "scenario"],
      });

      const scopes = reg.getScopesConsuming("scenario");
      expect(scopes).toContain("feature");
      expect(scopes).toContain("flow");
      expect(scopes.length).toBe(2);
    });
  });
});
