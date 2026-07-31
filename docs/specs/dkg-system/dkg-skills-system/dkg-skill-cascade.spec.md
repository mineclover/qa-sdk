---
def:
  tier: component
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
sources:
  - packages/dkg/src/dkg.types.ts
  - packages/dkg/src/graph-registry.ts
  - packages/dkg/src/skills/analyze-impact.ts
  - packages/dkg/src/skills/runtime-usage-audit.ts
  - packages/dkg/src/skills/runtime-usage-audit.test.ts
  - packages/dkg/src/skills/constraint-check.ts
  - packages/dkg/src/skills/safe-entry-add.ts
  - packages/dkg/src/skills/skill-chain.ts
  - packages/dkg/src/skills/converge-chain.ts
  - packages/dkg/src/dkg.test.ts
  - packages/dkg/src/skills/skills-suite.test.ts
  - packages/dkg/src/skills/converge-chain.test.ts
---
# analyzeImpact — 종단 Cascade


## 탐색 ^navigation

dkg-system > dkg-skills-system > **dkg-skill-cascade**

형제: `dkg-skill-migrator` · `dkg-skill-version-event` · `dkg-skill-decision` · `dkg-skill-catalog`

## 목적 ^purpose

DKG 그래프에서 특정 노드 변경의 영향을 종단까지 추적하는 skill. axis → prefix → domain → consumer 순서로 cascade를 추적하고, constraint 위반과 intent-link 파손을 감지한다.

## 구성 ^overview

6단계 분석 파이프라인: axis cascade → prefix cascade → constraint 검사 → intent-link 검사 → stride-break/migration 판정 → persisted runtime usage 보강. 입력은 `ImpactAnalysisInput`, 출력은 `ImpactAnalysisResult`와 CLI의 runtime usage read model이다.

## 입력 타입

소스 위치: `packages/dkg/src/dkg.types.ts`

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

소스 위치: `packages/dkg/src/skills/analyze-impact.ts`

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

### 6단계: Persisted Runtime Usage 보강

CLI의 `dkg run skill-analyze-impact`는 정적 cascade 결과에 다음 세 read model을
추가 대조한다.

- `usage_snapshots.addressUsages`: 과거 집계 snapshot에서 affected prefix가 관측된 횟수와 batch 시간 범위
- `flow_evidence_records`: raw runtime flow evidence에서 affected prefix가 관측된 record 수
- `cli_audit_events`: CLI audit의 `address_context`에 affected prefix가 등장한 event 수

순수 함수 `auditRuntimePrefixUsage()`는 저장소를 직접 참조하지 않고 read model만
받는다. historical snapshot도 runtime evidence로 표시하되 active consumer로
자동 판정하지 않으며, 이 audit는 migration 실행이나 observation 해소를 자동화하지
않는다.

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
