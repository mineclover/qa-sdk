---
def:
  id: dkg-skill-cascade
  address: def_document:v2:68765
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [decision, observability, runtime]
  links:
    - target: dkg-skill-catalog
      type: depends_on
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# analyzeImpact — 종단 Cascade


## 탐색 ^navigation

dkg-system > dkg-skills-system > **dkg-skill-cascade**

형제: `dkg-skill-migrator` · `dkg-skill-version-event` · `dkg-skill-decision` · `dkg-skill-catalog`

## 목적 ^purpose

DKG 그래프에서 특정 노드 변경의 영향을 종단까지 추적하는 skill. axis → prefix → domain → consumer 순서로 cascade를 추적하고, constraint 위반과 intent-link 파손을 감지한다.

## 구성 ^overview

5단계 분석 파이프라인: axis cascade → prefix cascade → constraint 검사 → intent-link 검사 → stride-break/migration 판정. 입력은 `ImpactAnalysisInput`, 출력은 `ImpactAnalysisResult`.

## 입력 타입

소스 위치: `packages/spec-core/src/dkg/dkg.types.ts`

```typescript
interface ImpactAnalysisInput {
  readonly type:
    | "entry-added" | "entry-deactivated" | "capacity-changed"
    | "dim-added" | "ref-changed" | "version-bump" | "new-prefix";
  readonly target: {
    readonly axis?: string;
    readonly prefix?: string;
    readonly fromVersion?: string;
    readonly toVersion?: string;
  };
  readonly detail?: string;
}
```

## 분석 파이프라인

소스 위치: `packages/spec-core/src/dkg/skills/analyze-impact.ts`

### 1단계: Axis Cascade

`target.axis`가 지정되면 `graph.cascadeFromAxis(axisId)` 호출.

- composes 역순회: 이 축을 직접 사용하는 prefix
- references 역순회 (transitive): 영향받는 prefix를 참조하는 prefix

### 2단계: Prefix Cascade

`target.prefix`가 직접 지정되었거나 1단계에서 파생된 prefix 목록에 대해 `graph.cascadeFromPrefix(prefixId)` 호출.

- contains 역순회: 소속 domain
- consumes 역순회: domain을 소비하는 consumer + 직접 소비 consumer

### 3단계: Constraint 검사

`graph.activeConstraints(targetId)`로 axis와 영향받는 모든 prefix에 적용되는 활성 constraint를 수집한다.

### 4단계: Intent-Link 검사

`graph.intentLinksFor(prefixId)`로 영향받는 prefix에 연결된 intent-link를 수집. invariant가 있으면 `BrokenIntentLink`으로 보고.

### 5단계: Stride-Break / Migration 판정

| 변경 유형 | strideBreak | migrationRequired | autoMigratable |
|-----------|-------------|-------------------|----------------|
| capacity-changed | true | true | true |
| dim-added | true | true | false |
| ref-changed | true | true | false |
| entry-added | false | false | true |
| entry-deactivated | false | false | false |
| version-bump | false | false | false |
| new-prefix | false | false | false |

## 출력 타입

```typescript
interface ImpactAnalysisResult {
  readonly strideBreak: boolean;
  readonly shapeChange?: { from: number[]; to: number[] };
  readonly affectedPrefixes: AffectedPrefix[];
  readonly affectedDomains: AffectedDomain[];
  readonly affectedConsumers: AffectedConsumer[];
  readonly migrationRequired: boolean;
  readonly autoMigratable: boolean;
  readonly constraintViolations: ConstraintViolation[];
  readonly brokenIntentLinks: BrokenIntentLink[];
}
```

## Skill Chain 연계

`analyzeImpact`는 다음 skill chain에서 중간 단계로 사용된다.

### entryAddChain

`safeEntryAdd` → **analyzeImpact** (내부 호출) → `constraintAudit` → `domainHealth` → `scaffoldDecision`

### convergeChain

4가지 행위(수렴/분기정리/선택지정리/관측)에서 overlap 분석과 함께 영향 범위를 파악한다.

## 설계 원칙

- `GraphPort` 인터페이스만 사용하여 convergence/schema 레이어에서도 호출 가능
- constraint 검사는 잠재적 위반 목록이므로 `severity` 필드는 미설정
- intent-link 파손은 invariant가 있는 링크만 보고 (invariant 없으면 endpoint 불완전만으로 위반 판정하지 않음)
