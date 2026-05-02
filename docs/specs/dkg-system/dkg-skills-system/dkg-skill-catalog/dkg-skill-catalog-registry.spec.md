---
def:
  tier: component
  id: dkg-skill-catalog-registry
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [entry-point, decision, data]
  links:
    - target: dkg-skill-catalog
      type: refines
    - target: dkg-skill-catalog-types
      type: depends_on
---
# Skill 레지스트리 (39개)


## 탐색 ^navigation

dkg-system > dkg-skills-system > dkg-skill-catalog > **dkg-skill-catalog-registry**

형제: `dkg-skill-catalog-types`

## 목적 ^purpose

DKG에 등록된 39개 skill의 전체 목록. 카테고리별 분류, CLI 연결 상태, 구현 소스 매핑.

정의: `demo-dkg-config.ts` SkillDef[]
구현: `spec-core/src/dkg/skills/*.ts`
CLI: `cli/src/commands/dkg.ts` dkgRun() switch

## read (5개)

| Skill ID | 소스 파일 | 입력 → 출력 |
|----------|----------|------------|
| `skill-trace` | trace.ts | nodeId → TraceResult |
| `skill-explore-service` | service-explorer.ts | serviceId → ServiceProfile |
| `skill-explore-prefix` | service-explorer.ts | prefixId → PrefixProfile |
| `skill-explore-dsl` | service-explorer.ts | dslId → DslProfile |
| `skill-system-overview` | service-explorer.ts | — → SystemOverview |

## write (5개)

| Skill ID | 소스 파일 | 입력 → 출력 |
|----------|----------|------------|
| `skill-record-decision` | record-operation.ts | targetId+type+title+rationale → DecisionNode |
| `skill-record-observation` | record-operation.ts | targetId+finding+intent → ObservationNode |
| `skill-claim` | claim-operation.ts | targetId+by → ClaimData+ClaimImpact |
| `skill-release` | claim-operation.ts | targetId → ObservationNode |
| `skill-lifecycle-transition` | lifecycle-transition.ts | nodeId+toLifecycle → TransitionResult |

## analysis (26개)

### 구조 분석 (10개)

| Skill ID | 소스 파일 | 입력 → 출력 |
|----------|----------|------------|
| `skill-safe-entry-add` | safe-entry-add.ts | axis+entry → SafeEntryAddResult |
| `skill-event-action-check` | constraint-check.ts | targetId → ConstraintCheckResult |
| `skill-svc-binding-check` | constraint-check.ts | targetId → ConstraintCheckResult |
| `skill-domain-health` | domain-health.ts | domainId? → DomainHealthResult |
| `skill-analyze-impact` | analyze-impact.ts | ImpactAnalysisInput → ImpactAnalysisResult |
| `skill-decision-scaffold` | decision-scaffold.ts | ScaffoldInput → DecisionNode |
| `skill-infer-migrator` | infer-migrator.ts | DiffInfo → InferredMigrator |
| `skill-observation-coverage` | coverage-audit.ts | UsageData → CoverageAuditResult |
| `skill-service-health` | service-skills.ts | registryUrl → ServiceHealthResult |
| `skill-event-coverage` | service-skills.ts | ingestUrl → EventCoverageResult |

### CLI 내장 (5개)

| Skill ID | 입력 → 출력 |
|----------|------------|
| `skill-self-check-analyze` | — → SelfCheckAnalysis |
| `skill-cli-coverage` | — → CliCoverageResult |
| `skill-promote-scan` | — → PromoteScanResult |
| `skill-spec-manage` | — → SpecListResult |
| `skill-registry-publish` | regUrl → PublishResult |

### 카탈로그 기반 감사 (5개)

| Skill ID | 입력 | 설명 |
|----------|------|------|
| `skill-schema-health-audit` | (없음) | prefix 카테고리 규칙 준수 감사 |
| `skill-commerce-skew-audit` | dslBundleId? | DSL 멤버 버전 스큐 탐지 |
| `skill-prefix-capacity-audit` | prefixId? | 주소 공간 headroom/utilization 감사 |
| `skill-gate-refentries-check` | (없음) | CON-006 refEntries 미정의 검사 |
| `skill-table-impact` | tableId? | DB 테이블 의존 체인 추적 |

### 런타임 데이터 기반 (5개)

데이터 없으면 구조(불변조건/규칙) 출력. 데이터 있으면 실 검증.

| Skill ID | 대상 | 설명 |
|----------|------|------|
| `skill-checkout-flow-verify` | dsl-checkout | 결제 플로우 불변조건 검증 |
| `skill-infra-impact-verify` | dsl-infra | 배포→장애 인과관계 검증 |
| `skill-pipeline-phase-verify` | dsl-pipeline | 파이프라인 위상 순서 검증 |
| `skill-pattern-analysis` | observation-domain | 패턴 규칙 + 세션 분류 |
| `skill-policy-rule-verify` | dsl-access-control | 권한 구조 + CON-003 검증 |

### flow 검증 (1개)

| Skill ID | 소스 파일 | 입력 → 출력 |
|----------|----------|------------|
| `skill-flow-trace` | flow-trace.ts | records → FlowTraceResult |

## chain (3개)

| Skill ID | 소스 파일 | 단계 |
|----------|----------|------|
| `skill-entry-add-chain` | skill-chain.ts | safe-add → constraint → domain → decision |
| `skill-system-health-chain` | skill-chain.ts | constraint → domain → observation |
| `skill-converge-chain` | converge-chain.ts | merge → deactivate → simplify → observe |

## 구현 소스 매핑

| 소스 파일 | 제공 함수 | 대응 skill |
|----------|----------|-----------|
| analyze-impact.ts | `analyzeImpact()` | skill-analyze-impact |
| claim-operation.ts | `prepareClaim()`, `prepareRelease()` | skill-claim, skill-release |
| constraint-check.ts | `checkConstraints()` | skill-event-action-check, skill-svc-binding-check |
| converge-chain.ts | `convergeChain()` | skill-converge-chain |
| coverage-audit.ts | `auditCoverage()` | skill-observation-coverage |
| decision-scaffold.ts | `scaffoldDecision()` | skill-decision-scaffold |
| domain-health.ts | `checkDomainHealth()`, `checkAllDomainsHealth()` | skill-domain-health |
| flow-trace.ts | `traceFlows()`, `validateDslInvariants()` | skill-flow-trace |
| infer-migrator.ts | `inferMigrator()` | skill-infer-migrator |
| lifecycle-transition.ts | `transitionPrefix()`, `transitionDecision()`, `resolveObservation()` | skill-lifecycle-transition |
| record-operation.ts | `recordDecision()`, `recordObservation()` | skill-record-decision, skill-record-observation |
| safe-entry-add.ts | `safeEntryAdd()` | skill-safe-entry-add |
| service-explorer.ts | `exploreService()`, `explorePrefix()`, `exploreDsl()`, `systemOverview()` | skill-explore-* |
| service-skills.ts | `serviceHealthCheck()`, `eventCoverageCheck()` | skill-service-health, skill-event-coverage |
| skill-chain.ts | `entryAddChain()`, `systemHealthChain()` | skill-entry-add-chain, skill-system-health-chain |
| trace.ts | `traceNode()` | skill-trace |
| version-event-derive.ts | `versionEventFromDiff()` | (헬퍼) |
