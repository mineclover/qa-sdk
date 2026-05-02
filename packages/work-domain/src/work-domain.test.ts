// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from "vitest";
import {
  WORK_DOMAINS,
  ALL_DOMAIN_IDS,
  getDomainDef,
  getSubDomain,
  resolveQualityGates,
  gatesToCriteria,
  mergeQualityGates,
  DOMAIN_TO_DEF_MAP,
  buildDocQuery,
  suggestDomainFromArtifact,
  classifyUserStory,
  classifyStories,
  GATE_KINDS,
  ALL_GATE_KIND_IDS,
  getGateKindDef,
  getGateKindsByScope,
  countByScope,
} from "./index.js";
import type { WorkDomainId } from "./types.js";
import type { GateKindId } from "./gate-kind.js";

// ─── 레지스트리 ─────────────────────────────────────────

describe("registry", () => {
  it("10 대분류가 정의되어 있다", () => {
    expect(WORK_DOMAINS).toHaveLength(10);
    expect(ALL_DOMAIN_IDS).toHaveLength(10);
  });

  it("모든 도메인에 고유한 ID가 있다", () => {
    const ids = WORK_DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 도메인에 한글 이름이 있다", () => {
    for (const domain of WORK_DOMAINS) {
      expect(domain.nameKo).toBeTruthy();
    }
  });

  it("모든 도메인에 최소 1개 서브도메인이 있다", () => {
    for (const domain of WORK_DOMAINS) {
      expect(domain.subDomains.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("모든 도메인에 최소 1개 품질 게이트가 있다", () => {
    for (const domain of WORK_DOMAINS) {
      expect(domain.qualityGates.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("getDomainDef()로 도메인을 조회할 수 있다", () => {
    const def = getDomainDef("data-infra");
    expect(def.nameKo).toBe("데이터 인프라");
  });

  it("getSubDomain()으로 서브도메인을 조회할 수 있다", () => {
    const sub = getSubDomain("backend-logic", "api-interface");
    expect(sub?.nameKo).toBe("API 인터페이스");
  });

  it("존재하지 않는 서브도메인은 undefined를 반환한다", () => {
    expect(getSubDomain("data-infra", "nonexistent")).toBeUndefined();
  });
});

// ─── 게이트 유형 택소노미 ───────────────────────────────

describe("gate-kind", () => {
  it("19개 게이트 유형이 정의되어 있다", () => {
    expect(GATE_KINDS).toHaveLength(19);
    expect(ALL_GATE_KIND_IDS).toHaveLength(19);
  });

  it("모든 유형에 고유한 ID가 있다", () => {
    const ids = GATE_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 유형에 한글 이름이 있다", () => {
    for (const kind of GATE_KINDS) {
      expect(kind.nameKo).toBeTruthy();
    }
  });

  it("모든 유형에 도구 예시가 있다", () => {
    for (const kind of GATE_KINDS) {
      expect(kind.toolExamples.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("getGateKindDef()로 유형을 조회할 수 있다", () => {
    const def = getGateKindDef("typecheck");
    expect(def.scope).toBe("static");
    expect(def.nameKo).toBe("타입 검사");
  });

  it("getGateKindsByScope()로 범위별 필터링한다", () => {
    const statics = getGateKindsByScope("static");
    expect(statics.length).toBe(3); // typecheck, lint, static-analysis
    expect(statics.every((k) => k.scope === "static")).toBe(true);
  });

  it("countByScope()가 범위별 카운트를 반환한다", () => {
    const counts = countByScope();
    expect(counts.static).toBe(3);
    expect(counts.unit).toBe(2);
    expect(counts.integration).toBe(3);
    expect(counts.system).toBe(3);
    expect(counts.build).toBe(2);
    expect(counts.audit).toBe(4);
    expect(counts.ai).toBe(2);
  });

  it("레지스트리의 모든 gate.kind가 유효한 GateKindId다", () => {
    const validKinds = new Set<string>(ALL_GATE_KIND_IDS);
    for (const domain of WORK_DOMAINS) {
      for (const gate of domain.qualityGates) {
        expect(validKinds.has(gate.kind)).toBe(true);
      }
    }
  });
});

// ─── 품질 게이트 ────────────────────────────────────────

describe("quality-gates", () => {
  it("도메인 ID로 품질 게이트를 반환한다", () => {
    const gates = resolveQualityGates("data-infra");
    expect(gates.length).toBeGreaterThanOrEqual(1);
    expect(gates.some((g) => g.id === "typecheck")).toBe(true);
  });

  it("pkg 인자로 <pkg> 플레이스홀더를 치환한다", () => {
    const gates = resolveQualityGates("data-infra", "@qa-sdk/core");
    const buildGate = gates.find((g) => g.id === "build");
    expect(buildGate?.command).toBe("pnpm --filter @qa-sdk/core build");
  });

  it("gatesToCriteria()가 문자열 배열을 반환한다", () => {
    const gates = resolveQualityGates("backend-logic", "my-pkg");
    const criteria = gatesToCriteria(gates);
    expect(criteria.every((c) => c.endsWith(" passes"))).toBe(true);
  });

  it("mergeQualityGates()가 중복을 제거한다", () => {
    // data-infra와 backend-logic 모두 typecheck 게이트를 가진다
    const merged = mergeQualityGates(["data-infra", "backend-logic"]);
    const typecheckCount = merged.filter((g) => g.id === "typecheck").length;
    expect(typecheckCount).toBe(1);
  });

  it("mergeQualityGates()가 양쪽 도메인 고유 게이트를 포함한다", () => {
    const merged = mergeQualityGates(["data-infra", "backend-logic"]);
    const ids = merged.map((g) => g.id);
    // backend-logic 고유 게이트
    expect(ids).toContain("api-test");
  });
});

// ─── definition-catalog 매핑 ────────────────────────────

describe("mapping", () => {
  it("모든 도메인에 매핑이 정의되어 있다", () => {
    for (const id of ALL_DOMAIN_IDS) {
      expect(DOMAIN_TO_DEF_MAP[id]).toBeDefined();
    }
  });

  it("매핑이 유효한 scope/layer 값을 포함한다", () => {
    const validScopes = ["ui", "feature", "flow", "state", "constraint", "data", "interface"];
    const validLayers = ["domain", "operation", "mediation", "experience"];

    for (const [, mapping] of Object.entries(DOMAIN_TO_DEF_MAP)) {
      for (const scope of mapping.primaryScopes) {
        expect(validScopes).toContain(scope);
      }
      expect(validLayers).toContain(mapping.primaryLayer);
    }
  });

  it("buildDocQuery()가 검색 파라미터를 반환한다", () => {
    const query = buildDocQuery("security-guardrail");
    expect(query.scopes).toContain("constraint");
    expect(query.layer).toBe("domain");
    expect(query.tags).toContain("security");
  });

  it("suggestDomainFromArtifact()가 알려진 값을 매핑한다", () => {
    expect(suggestDomainFromArtifact("schema")).toBe("data-infra");
    expect(suggestDomainFromArtifact("component")).toBe("ui-component");
    expect(suggestDomainFromArtifact("module")).toBe("backend-logic");
  });

  it("suggestDomainFromArtifact()가 알 수 없는 값에 undefined를 반환한다", () => {
    expect(suggestDomainFromArtifact("unknown-type")).toBeUndefined();
  });
});

// ─── 자동 분류 ──────────────────────────────────────────

describe("classify", () => {
  it("DB 관련 스토리를 data-infra로 분류한다", () => {
    const result = classifyUserStory({
      title: "definition-service 마이그레이션 SQL IF NOT EXISTS 추가",
      description: "drizzle 마이그레이션 SQL에 IF NOT EXISTS가 누락된 문제를 수정한다.",
    });
    expect(result.domain).toBe("data-infra");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("API 관련 스토리를 backend-logic으로 분류한다", () => {
    const result = classifyUserStory({
      title: "인증 미들웨어 JWT 검증 추가",
      description: "JWT 토큰을 검증하는 auth middleware를 구현한다.",
    });
    expect(result.domain).toBe("backend-logic");
  });

  it("UI 관련 스토리를 ui-component로 분류한다", () => {
    const result = classifyUserStory({
      title: "버튼 컴포넌트 접근성 개선",
      description: "Button component에 focus-visible 스타일을 추가한다.",
    });
    expect(result.domain).toBe("ui-component");
  });

  it("접근성 관련 스토리를 global-inclusion으로 분류한다", () => {
    const result = classifyUserStory({
      title: "ARIA 랜드마크 삽입",
      description: "WCAG 기준으로 ARIA landmark role을 추가하고 screen-reader 테스트를 한다.",
    });
    expect(result.domain).toBe("global-inclusion");
  });

  it("보안 관련 스토리를 security-guardrail로 분류한다", () => {
    const result = classifyUserStory({
      title: "PII 마스킹 로직 구현",
      description: "사용자 입력에서 injection 공격을 방지하고 PII를 masking 처리한다.",
    });
    expect(result.domain).toBe("security-guardrail");
  });

  it("키워드가 없으면 confidence 0으로 fallback을 반환한다", () => {
    const result = classifyUserStory({
      title: "뭔가 한다",
      description: "뭔가를 구현한다.",
    });
    expect(result.confidence).toBe(0);
  });

  it("signals에 매칭된 키워드가 포함된다", () => {
    const result = classifyUserStory({
      title: "schema migration 수정",
      description: "drizzle schema를 수정한다",
    });
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.signals).toContain("schema");
  });

  it("classifyStories()가 배열을 일괄 분류한다", () => {
    const results = classifyStories([
      { title: "DB schema 변경", description: "테이블 추가" },
      { title: "Button component", description: "스타일 변경" },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].domain).toBe("data-infra");
    expect(results[1].domain).toBe("ui-component");
  });

  // 실제 prd.json 스토리로 검증 (Drizzle 표준화 PRD)
  it("실제 스토리: 'definition-service 마이그레이션' → data-infra", () => {
    const result = classifyUserStory({
      title: "definition-service 마이그레이션 SQL IF NOT EXISTS 추가",
      description: "definition-service의 drizzle 마이그레이션 SQL에 IF NOT EXISTS가 누락된 문제를 수정하여 기존 데이터가 있는 DB에서도 안전하게 마이그레이션이 실행되도록 한다.",
    });
    expect(result.domain).toBe("data-infra");
  });

  it("실제 스토리: 'drizzle-kit 셋업' → data-infra", () => {
    const result = classifyUserStory({
      title: "query-service drizzle-kit 셋업 완성",
      description: "query-service에 drizzle-kit + drizzle.config.ts + 마이그레이션 폴더를 추가하여 이중 관리를 제거한다.",
    });
    expect(result.domain).toBe("data-infra");
  });
});
