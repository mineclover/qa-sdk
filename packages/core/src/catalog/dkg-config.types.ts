/**
 * DkgConfig — DKG 부트스트랩 설정의 선언적 표현.
 *
 * bootstrap.ts의 하드코딩 데이터를 선언적 구조로 추출.
 * Catalog(구조) + DkgConfig(의미) = 완전한 DKG 입력.
 */

// ── Domain ────────────────────────────────────────────────────

export interface DomainDef {
  readonly id: string;
  readonly name: string;
  readonly prefixes: readonly string[];
  readonly sharedAxes: readonly string[];
  readonly boundary: {
    readonly exports: readonly string[];
    readonly internal: readonly string[];
  };
  readonly rationale: string;
}

// ── Consumer ──────────────────────────────────────────────────

export interface ConsumerDef {
  readonly id: string;
  readonly type: "client" | "service";
  readonly intendedPrefixes: readonly string[];
  readonly rationale: string;
}

// ── Constraint ────────────────────────────────────────────────

export interface ConstraintDef {
  readonly id: string;
  readonly rule: string;
  readonly formal?: string;
  readonly scope: readonly string[];
  readonly lifecycle: "active" | "deprecated";
}

// ── DSL Bundle ────────────────────────────────────────────────

export interface DslBundleDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly memberPrefixes: readonly string[];
  readonly serviceBindingPrefix: string;
  readonly fixedDims: readonly string[];
  readonly invariants?: readonly string[];
}

// ── Intent Link ───────────────────────────────────────────────

export interface IntentLinkDef {
  readonly id: string;
  readonly endpoints: readonly string[];
  readonly via: string;
  readonly intent: string;
  readonly invariant?: string;
}

// ── Skill ─────────────────────────────────────────────────────

export interface SkillDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: "read" | "write" | "analysis" | "chain";
  readonly targetKinds: readonly string[];
  readonly input: string;
  readonly output: string;
  readonly depends?: readonly string[];
  readonly specialization?: Record<string, unknown>;
}

// ── Spec ──────────────────────────────────────────────────────

export interface SpecDef {
  readonly id: string;
  readonly type: "req" | "feat" | "uc" | "evt" | "ls" | "adr";
  readonly title: string;
  readonly lifecycle: "draft" | "active" | "deprecated";
  /** spec이 governs하는 prefix/axis ID 목록 */
  readonly governs?: readonly string[];
}

// ── Review Pair (prefix 구조 유사도 검토) ─────────────────────

export interface ReviewPairDef {
  readonly a: string;
  readonly b: string;
  readonly reason: string;
}

// ── DkgConfig (통합) ──────────────────────────────────────────

export interface DkgConfig {
  readonly domains: readonly DomainDef[];
  readonly consumers: readonly ConsumerDef[];
  readonly constraints: readonly ConstraintDef[];
  readonly dslBundles: readonly DslBundleDef[];
  readonly intentLinks: readonly IntentLinkDef[];
  readonly skills: readonly SkillDef[];
  readonly specs?: readonly SpecDef[];
  readonly reviewPairs?: readonly ReviewPairDef[];
}
