---
def:
  id: dkg-skill-catalog
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [tier-system]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# Skill 카탈로그

## 목적 ^purpose

DKG skill을 등록/조회/실행하는 카탈로그. 각 skill의 targetKinds, specialization, category(read/write/analysis/chain)를 관리한다.

## 구성 ^overview

SkillNode 타입 정의, 4개 카테고리(read/write/analysis/chain), 전문화(specialization) 메커니즘, DKG 등록 체계, skill 목록으로 구성된다.

## SkillNode 타입

소스 위치: `packages/spec-core/src/dkg/dkg.types.ts`

```typescript
interface SkillNode {
  readonly kind: "skill";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: SkillCategory;         // "read" | "write" | "analysis" | "chain"
  readonly targetKinds: readonly string[];   // 대상 노드 종류
  readonly input: string;
  readonly output: string;
  readonly depends?: readonly string[];
  readonly specialization?: SkillSpecialization;
}
```

## 카테고리 분류

| 카테고리 | 설명 | 대표 skill |
|---------|------|-----------|
| `read` | 그래프에서 정보를 읽기만 함 | `traceNode`, `exploreService`, `explorePrefix`, `exploreDsl` |
| `write` | 그래프에 노드/엣지를 추가 | `recordDecision`, `recordObservation`, `transitionPrefix` |
| `analysis` | 데이터를 분석하여 결과를 반환 | `analyzeImpact`, `inferMigrator`, `auditCoverage`, `checkDomainHealth` |
| `chain` | 여러 skill을 순차 실행 | `entryAddChain`, `systemHealthChain`, `convergeChain` |

## 전문화 (Specialization)

SkillSpecialization은 skill이 특정 컨텍스트에 전문화되었음을 선언한다.

```typescript
interface SkillSpecialization {
  readonly domains?: readonly string[];
  readonly dslBundles?: readonly string[];
  readonly prefixes?: readonly string[];
  readonly intentLinks?: readonly string[];
  readonly constraints?: readonly string[];
  readonly invariants?: readonly string[];
  readonly metrics?: readonly string[];
  readonly api?: string | readonly string[];
  readonly autoObservation?: boolean;
  readonly observationTemplate?: string;
}
```

### 전문 skill vs 범용 skill

`traceNode()`에서 노드에 적용 가능한 skill을 탐색할 때:

1. **전문 skill**: specialization의 prefixes/domains/dslBundles/intentLinks/constraints에 해당 nodeId가 포함된 skill
2. **범용 skill**: specialization이 없고, targetKinds가 비어있거나 노드 kind와 일치하는 skill

### 자동 관측 (autoObservation)

`autoObservation: true`이면 skill 실행 결과에서 Observation을 자동 생성한다. `observationTemplate`으로 ID 패턴을 지정 가능.

## DKG 등록 체계

`bootstrapDkg()`에서 DkgConfig의 `skills` 배열을 순회하며 등록한다.

```typescript
// bootstrap.ts
for (const skill of config.skills) {
  graph.addNode(skill);
  if (skill.depends) {
    for (const depId of skill.depends) {
      graph.addEdge("depends-on", skill.id, depId);
    }
  }
}
```

- Skill 간 의존은 `depends-on` 엣지로 표현
- Skill은 DKG 노드이므로 `traceNode()`로 역추적 가능

## Skill 목록

### 분석 Skill

| ID | 소스 파일 | 입력 | 출력 |
|----|----------|------|------|
| `analyzeImpact` | `skills/analyze-impact.ts` | `ImpactAnalysisInput` | `ImpactAnalysisResult` |
| `inferMigrator` | `skills/infer-migrator.ts` | `DiffInfo` | `InferredMigrator` |
| `versionEventFromDiff` | `skills/version-event-derive.ts` | `DiffInput` | `VersionEventNode` |
| `safeEntryAdd` | `skills/safe-entry-add.ts` | `SafeEntryAddInput` | `SafeEntryAddResult` |
| `auditCoverage` | `skills/coverage-audit.ts` | `EntryUsage[], AddressUsage[]` | `CoverageAuditResult` |
| `checkDomainHealth` | `skills/domain-health.ts` | `domainId` | `DomainHealthResult` |
| `checkConstraints` | `skills/constraint-check.ts` | `targetId` | `ConstraintCheckResult` |

### 탐색 Skill

| ID | 소스 파일 | 입력 | 출력 |
|----|----------|------|------|
| `exploreService` | `skills/service-explorer.ts` | `serviceId` | `ServiceProfile` |
| `explorePrefix` | `skills/service-explorer.ts` | `prefixId` | `PrefixProfile` |
| `exploreDsl` | `skills/service-explorer.ts` | `dslId` | `DslProfile` |
| `systemOverview` | `skills/service-explorer.ts` | - | `SystemOverview` |
| `traceNode` | `skills/trace.ts` | `nodeId` | `TraceResult` |

### 체인 Skill

| ID | 소스 파일 | 단계 |
|----|----------|------|
| `entryAddChain` | `skills/skill-chain.ts` | safe-add → constraint → domain → decision |
| `systemHealthChain` | `skills/skill-chain.ts` | constraint → domain → observation |
| `convergeChain` | `skills/converge-chain.ts` | merge → deactivate → simplify → observe |

### 운영 Skill

| ID | 소스 파일 | 설명 |
|----|----------|------|
| `scaffoldDecision` | `shared/decision-scaffold.ts` | 의사결정 템플릿 생성 |
| `traceFlows` | `skills/flow-trace.ts` | IntentLink invariant 검증 |
| `validateDslInvariants` | `skills/flow-trace.ts` | DSL 불변조건 검증 |
| `serviceHealthCheck` | `skills/service-skills.ts` | 서비스 헬스체크 (외부 API) |
| `eventCoverageCheck` | `skills/service-skills.ts` | 이벤트 커버리지 (외부 API) |
| `recordDecision` | `skills/record-operation.ts` | Decision 기록 |
| `recordObservation` | `skills/record-operation.ts` | Observation 기록 |
| `transitionPrefix` | `skills/lifecycle-transition.ts` | Prefix lifecycle 전이 |
| `transitionDecision` | `skills/lifecycle-transition.ts` | Decision lifecycle 전이 |
| `resolveObservation` | `skills/lifecycle-transition.ts` | Observation 해소 |
