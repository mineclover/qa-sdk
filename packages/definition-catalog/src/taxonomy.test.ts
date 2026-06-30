// @def.doc definition-taxonomy

import { describe, it, expect } from "vitest";
import {
  DEFINITION_TAXONOMY,
  VALID_SCOPE_ASPECTS,
  ASPECT_TO_SCOPES,
  SEMANTIC_LINT_FAMILIES,
  validateScopeAspect,
  isValidScopeAspect,
  allValidCombinations,
  CONCERN_TAGS,
  STRUCTURAL_TAGS,
  KNOWN_TAGS,
  isKnownTag,
  detectCrossScope,
  CLASSIFICATION_CONVENTIONS,
  CONTRACT_MARKERS,
  CONTRACT_MARKER_NAMES,
  isContractMarker,
  getContractMarkerDef,
} from "./taxonomy.js";
import { DEF_SCOPE, DEF_ASPECT, DEF_LEVEL } from "./vocabulary.js";

describe("DEF_LEVEL", () => {
  it("frontmatter 검증과 같은 3단계 역할 level을 사용한다", () => {
    expect(DEF_LEVEL.entries).toEqual(["group", "module", "leaf"]);
    expect(DEF_LEVEL.capacity).toBe(8);
  });
});

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

  it("각 scope에 최소 1개 이상의 aspect가 있다 (예외: decision scope는 0개)", () => {
    // meta scope은 단일 aspect(proposal_design)를 갖는 설계적 예외.
    // decision scope (v0.14)는 단일 단위 문서이므로 aspect 0개 — 좌표 인코딩 대상 아님.
    // 나머지 도메인 scope은 일반적으로 2개 이상을 권장하지만,
    // 분류 기준(최소 aspect 1개)만 강제한다.
    const SCOPES_WITHOUT_ASPECTS = new Set(["decision"]);
    for (const scope of DEFINITION_TAXONOMY.scopes) {
      if (SCOPES_WITHOUT_ASPECTS.has(scope.id)) {
        expect(scope.aspects.length).toBe(0);
        continue;
      }
      expect(scope.aspects.length).toBeGreaterThanOrEqual(1);
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

describe("ASPECT_TO_SCOPES 역참조 (N:M)", () => {
  it("모든 aspect에 대해 scope 배열을 반환한다", () => {
    for (const aspect of DEF_ASPECT.entries) {
      expect(ASPECT_TO_SCOPES[aspect]).toBeDefined();
      expect(ASPECT_TO_SCOPES[aspect].length).toBeGreaterThan(0);
    }
  });

  it("VALID_SCOPE_ASPECTS와 일관된다", () => {
    for (const [scope, aspects] of Object.entries(VALID_SCOPE_ASPECTS)) {
      for (const aspect of aspects) {
        expect(ASPECT_TO_SCOPES[aspect]).toContain(scope);
      }
    }
  });

  it("ASPECT_TO_SCOPES의 전체 조합 수가 allValidCombinations과 일치한다", () => {
    const totalFromScopes = Object.values(ASPECT_TO_SCOPES)
      .reduce((sum, scopes) => sum + scopes.length, 0);
    expect(totalFromScopes).toBe(allValidCombinations().length);
  });
});

describe("SEMANTIC_LINT_FAMILIES", () => {
  it("semantic lint family가 선언되어 있다", () => {
    expect(SEMANTIC_LINT_FAMILIES.length).toBeGreaterThan(0);
  });

  it("family id는 유일하다", () => {
    const ids = SEMANTIC_LINT_FAMILIES.map((family) => family.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("seed와 traversal이 비어 있지 않다", () => {
    for (const family of SEMANTIC_LINT_FAMILIES) {
      expect(family.seeds.length).toBeGreaterThan(0);
      expect(family.traversal.length).toBeGreaterThan(0);
      expect(family.containsDepthLimit).toBeGreaterThanOrEqual(4);
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
  it("KNOWN_TAGS = CONCERN_TAGS + STRUCTURAL_TAGS", () => {
    expect(KNOWN_TAGS.length).toBe(CONCERN_TAGS.length + STRUCTURAL_TAGS.length);
    for (const t of CONCERN_TAGS) expect(KNOWN_TAGS).toContain(t);
    for (const t of STRUCTURAL_TAGS) expect(KNOWN_TAGS).toContain(t);
  });

  it("태그 간 중복 없음", () => {
    expect(new Set(KNOWN_TAGS).size).toBe(KNOWN_TAGS.length);
  });

  it("isKnownTag는 알려진 태그에 true", () => {
    expect(isKnownTag("security")).toBe(true);
    expect(isKnownTag("cross-scope")).toBe(true);
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
  it("27개 컨벤션이 정의되어 있다", () => {
    const keys = Object.keys(CLASSIFICATION_CONVENTIONS);
    expect(keys.length).toBe(27);
    // 분류 (C1-C6)
    expect(keys).toContain("scopeByAudience");
    expect(keys).toContain("splitThreshold");
    // 작성 (C8-C13)
    expect(keys).toContain("customMarkers");
    // 코드 참조 (C14-C18)
    expect(keys).toContain("noInlineCode");
    expect(keys).toContain("scopeTemplates");
    // 그룹 분류 (C19-C21)
    expect(keys).toContain("groupScopeByResponsibility");
    expect(keys).toContain("flowOnlyForFlow");
    expect(keys).toContain("structuralTag");
    // 코드-문서 연결 (C22-C24)
    expect(keys).toContain("svcMapping");
    expect(keys).toContain("accuracyOverVolume");
    expect(keys).toContain("aspectDistribution");
    // 계약 조립 (C25)
    expect(keys).toContain("contractAsConstellation");
  });
});

// ─── 계약 마커 레지스트리 ──────────────────────────────────

describe("CONTRACT_MARKERS", () => {
  it("8개 계약 마커가 정의되어 있다", () => {
    expect(CONTRACT_MARKERS.length).toBe(8);
    expect(CONTRACT_MARKER_NAMES.length).toBe(8);
  });

  it("모든 마커의 naturalScope가 유효한 scope이다", () => {
    for (const m of CONTRACT_MARKERS) {
      expect(VALID_SCOPE_ASPECTS[m.naturalScope]).toBeDefined();
    }
  });

  it("마커 이름에 중복이 없다", () => {
    expect(new Set(CONTRACT_MARKER_NAMES).size).toBe(CONTRACT_MARKER_NAMES.length);
  });

  it("isContractMarker는 계약 마커에 true", () => {
    expect(isContractMarker("inputs")).toBe(true);
    expect(isContractMarker("outputs")).toBe(true);
    expect(isContractMarker("precondition")).toBe(true);
    expect(isContractMarker("postcondition")).toBe(true);
    expect(isContractMarker("decision-point")).toBe(true);
    expect(isContractMarker("failure")).toBe(true);
    expect(isContractMarker("evidence")).toBe(true);
    expect(isContractMarker("flow-steps")).toBe(true);
  });

  it("isContractMarker는 비계약 마커에 false", () => {
    expect(isContractMarker("purpose")).toBe(false);
    expect(isContractMarker("overview")).toBe(false);
    expect(isContractMarker("constraint")).toBe(false);
    expect(isContractMarker("unknown")).toBe(false);
  });

  it("getContractMarkerDef는 정의를 반환한다", () => {
    const def = getContractMarkerDef("inputs");
    expect(def).toBeDefined();
    expect(def!.naturalScope).toBe("interface");
    expect(def!.modeHint).toBe("code");
    expect(def!.contractRole).toBe("boundary.inputs");
  });

  it("getContractMarkerDef는 비계약 마커에 undefined", () => {
    expect(getContractMarkerDef("purpose")).toBeUndefined();
  });

  it("modeHint: decision-point만 llm, 나머지는 code", () => {
    const llmMarkers = CONTRACT_MARKERS.filter(m => m.modeHint === "llm");
    expect(llmMarkers.length).toBe(1);
    expect(llmMarkers[0].marker).toBe("decision-point");
  });

  it("scope 분포: 각 naturalScope가 최소 1개 마커를 가진다", () => {
    const scopeSet = new Set(CONTRACT_MARKERS.map(m => m.naturalScope));
    // interface, constraint, flow, state, feature
    expect(scopeSet.size).toBeGreaterThanOrEqual(4);
  });
});
