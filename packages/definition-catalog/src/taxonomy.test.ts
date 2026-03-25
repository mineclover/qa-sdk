import { describe, it, expect } from "vitest";
import {
  DEFINITION_TAXONOMY,
  VALID_SCOPE_ASPECTS,
  ASPECT_TO_SCOPE,
  validateScopeAspect,
  isValidScopeAspect,
  allValidCombinations,
  CONCERN_TAGS,
  STRUCTURAL_TAGS,
  TIER_TAGS,
  KNOWN_TAGS,
  isKnownTag,
  detectCrossScope,
  CLASSIFICATION_CONVENTIONS,
} from "./taxonomy.js";
import { DEF_SCOPE, DEF_ASPECT } from "./vocabulary.js";

describe("DEFINITION_TAXONOMY", () => {
  it("7대 분류(scope)를 포함한다", () => {
    expect(DEFINITION_TAXONOMY.scopes.length).toBe(DEF_SCOPE.entries.length);
    const scopeIds = DEFINITION_TAXONOMY.scopes.map(s => s.id);
    for (const entry of DEF_SCOPE.entries) {
      expect(scopeIds).toContain(entry);
    }
  });

  it("모든 aspect가 정확히 하나의 scope에 속한다", () => {
    const allAspects = DEFINITION_TAXONOMY.scopes.flatMap(s => s.aspects.map(a => a.id));
    // 총 20개 aspect
    expect(allAspects.length).toBe(DEF_ASPECT.entries.length);
    // 모든 aspect가 DEF_ASPECT.entries에 포함
    for (const aspect of allAspects) {
      expect(DEF_ASPECT.entries).toContain(aspect);
    }
    // 중복 없음
    expect(new Set(allAspects).size).toBe(allAspects.length);
  });

  it("각 scope에 최소 2개 이상의 aspect가 있다", () => {
    for (const scope of DEFINITION_TAXONOMY.scopes) {
      expect(scope.aspects.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("VALID_SCOPE_ASPECTS", () => {
  it("모든 scope를 커버한다", () => {
    const scopeKeys = Object.keys(VALID_SCOPE_ASPECTS);
    expect(scopeKeys.length).toBe(DEF_SCOPE.entries.length);
    for (const entry of DEF_SCOPE.entries) {
      expect(scopeKeys).toContain(entry);
    }
  });

  it("모든 aspect가 정확히 하나의 scope에 속한다", () => {
    const allMapped = Object.values(VALID_SCOPE_ASPECTS).flat();
    expect(allMapped.length).toBe(DEF_ASPECT.entries.length);
    expect(new Set(allMapped).size).toBe(allMapped.length);
  });

  it("taxonomy tree와 일치한다", () => {
    for (const scope of DEFINITION_TAXONOMY.scopes) {
      const expected = scope.aspects.map(a => a.id);
      expect(VALID_SCOPE_ASPECTS[scope.id]).toEqual(expected);
    }
  });
});

describe("ASPECT_TO_SCOPE 역참조", () => {
  it("모든 aspect에 대해 scope를 반환한다", () => {
    for (const aspect of DEF_ASPECT.entries) {
      expect(ASPECT_TO_SCOPE[aspect]).toBeDefined();
    }
  });

  it("VALID_SCOPE_ASPECTS와 일관된다", () => {
    for (const [scope, aspects] of Object.entries(VALID_SCOPE_ASPECTS)) {
      for (const aspect of aspects) {
        expect(ASPECT_TO_SCOPE[aspect]).toBe(scope);
      }
    }
  });
});

describe("validateScopeAspect", () => {
  it("유효한 조합은 통과한다", () => {
    for (const combo of allValidCombinations()) {
      expect(() => validateScopeAspect(combo.scope, combo.aspect)).not.toThrow();
    }
  });

  it("무효한 조합은 에러를 던진다", () => {
    // ui scope에 domain_data aspect는 무효
    expect(() => validateScopeAspect("ui", "domain_data")).toThrow();
    // data scope에 layout aspect는 무효
    expect(() => validateScopeAspect("data", "layout")).toThrow();
    // feature scope에 app_state aspect는 무효
    expect(() => validateScopeAspect("feature", "app_state")).toThrow();
  });
});

describe("isValidScopeAspect", () => {
  it("유효한 조합은 true", () => {
    expect(isValidScopeAspect("ui", "layout")).toBe(true);
    expect(isValidScopeAspect("data", "domain_data")).toBe(true);
  });

  it("무효한 조합은 false", () => {
    expect(isValidScopeAspect("ui", "domain_data")).toBe(false);
    expect(isValidScopeAspect("state", "layout")).toBe(false);
  });
});

describe("allValidCombinations", () => {
  it("유효 조합 수 = aspect 수", () => {
    const combos = allValidCombinations();
    expect(combos.length).toBe(DEF_ASPECT.entries.length);
  });
});

// ─── 태그 체계 ──────────────────────────────────────────

describe("태그 레지스트리", () => {
  it("KNOWN_TAGS = CONCERN_TAGS + STRUCTURAL_TAGS + TIER_TAGS", () => {
    expect(KNOWN_TAGS.length).toBe(CONCERN_TAGS.length + STRUCTURAL_TAGS.length + TIER_TAGS.length);
    for (const t of CONCERN_TAGS) expect(KNOWN_TAGS).toContain(t);
    for (const t of STRUCTURAL_TAGS) expect(KNOWN_TAGS).toContain(t);
    for (const t of TIER_TAGS) expect(KNOWN_TAGS).toContain(t);
  });

  it("태그 간 중복 없음", () => {
    expect(new Set(KNOWN_TAGS).size).toBe(KNOWN_TAGS.length);
  });

  it("isKnownTag는 알려진 태그에 true", () => {
    expect(isKnownTag("security")).toBe(true);
    expect(isKnownTag("cross-scope")).toBe(true);
    expect(isKnownTag("tier-infra")).toBe(true);
    expect(isKnownTag("unknown-tag")).toBe(false);
  });
});

describe("detectCrossScope", () => {
  it("cross-scope 태그가 있으면 감지", () => {
    const result = detectCrossScope(["cross-scope", "ui"]);
    expect(result.isCrossScope).toBe(true);
  });

  it("scope 이름이 2개 이상이면 cross-scope", () => {
    const result = detectCrossScope(["ui", "data"]);
    expect(result.isCrossScope).toBe(true);
    expect(result.scopeRefs).toEqual(["ui", "data"]);
    expect(result.shouldSplit).toBe(false);
  });

  it("scope 이름이 3개 이상이면 분리 후보", () => {
    const result = detectCrossScope(["ui", "state", "interface"]);
    expect(result.shouldSplit).toBe(true);
    expect(result.scopeRefs.length).toBe(3);
  });

  it("scope 이름이 없으면 cross-scope 아님", () => {
    const result = detectCrossScope(["security", "testing"]);
    expect(result.isCrossScope).toBe(false);
    expect(result.shouldSplit).toBe(false);
  });
});

describe("CLASSIFICATION_CONVENTIONS", () => {
  it("12개 컨벤션이 정의되어 있다 (분류 6 + 작성 6)", () => {
    const keys = Object.keys(CLASSIFICATION_CONVENTIONS);
    expect(keys.length).toBe(12);
    expect(keys).toContain("scopeByAudience");
    expect(keys).toContain("customMarkers");
  });
});
