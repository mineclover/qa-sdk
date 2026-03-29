---
def:
  id: definition-harness-derive
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  svc: definition-service
  tags: [tier-system]
  links:
    - target: definition-harness
      type: refines
    - target: definition-state-model
      type: depends_on
    - target: spec-verification-system
      type: depends_on
---
# Harness Derive — 자동 상태 파생

## 목적 ^purpose

코드/테스트/문서/시스템의 현재 상태를 분석하여 11개 머신의 상태를 자동으로 결정한다. 수동 상태 관리 없이 관찰 가능한 사실에서 상태를 파생한다.

## 파생 규칙 ^constraint

### doc-lifecycle

frontmatter의 `lifecycle` 필드에서 직접 읽음 — 파생 불필요.

### spec-impl

| 조건 | 파생 상태 |
|------|----------|
| frontmatter만 있고 svc 없음 | `designed` |
| svc 있고 코드 디렉토리에 파일 없음 | `designed` |
| svc 있고 코드 존재하나 테스트 없음 | `implementing` |
| svc 있고 코드 존재 | `implemented` |
| svc 있고 코드 존재 + 관련 테스트 통과 | `verified` |
| 문서에 코드 블록 없고 소스 참조만 있음 | `source-referenced` |

판별 입력: `svc` 필드 → `packages/` 디렉토리 매핑, `def find-by-file` 역매핑, spec-tracker 증거, 문서 본문 패턴 감지

### convention-compliance

| 조건 | 파생 상태 |
|------|----------|
| spec-tracker 증거 0건 | `unverified` |
| spec-tracker coverage < 100% | `partial` |
| spec-tracker coverage = 100% | `compliant` |
| spec-tracker에 failed 증거 있음 | `violated` |

### db-sync

| 조건 | 파생 상태 |
|------|----------|
| def-config.json 없음 | `out-of-sync` |
| config의 documentCount ≠ scan 결과 | `drift-detected` |
| config checksum과 현재 파일 해시 불일치 | `drift-detected` |
| 전부 일치 | `synced` |

### address-state

GateEngine의 기존 `computeStateRanges()` 결과에서 파생. dim별 entry flag 조합으로 결정.

| 조건 | 파생 상태 |
|------|----------|
| 모든 dim이 encode✓ decode✓ | `active` |
| 어느 dim이 encode✗ decode✓ | `inactive` |
| 어느 dim이 encode✓ decode✗ | `open` |
| inactive ∩ open | `reserved` (자동 승격) |

소스: `index-meta/src/invalid-ranges.ts:computeStateRanges()`

### version-lifecycle

index-meta의 VersionLifecycleStore에서 직접 읽음.

| 조건 | 파생 상태 |
|------|----------|
| `VersionRecord.status` 값 | 그대로 매핑 (draft/released/active/deprecated) |

소스: `index-meta/src/version-lifecycle.ts`

### decision-flow

decision-flow-store의 FlowInstance에서 직접 읽음.

| 조건 | 파생 상태 |
|------|----------|
| `FlowInstance.status` 값 | 그대로 매핑 (pending/active/completed/abandoned/blocked) |

소스: `decision-flow-store/src/store.ts`

### service-status

registry-service의 서비스 레코드에서 파생.

| 조건 | 파생 상태 |
|------|----------|
| 서비스 prefix가 catalog에 존재 + ownedPrefixes 비어있지 않음 | `active` |
| deprecated 태그 있음 | `deprecated` |
| catalog에서 제거됨 | `retired` |

### event-status

event-catalog의 CoreEventDef에서 파생.

| 조건 | 파생 상태 |
|------|----------|
| `isCoreEvent(eventKey)` = true | `active` |
| event_key에 deprecated 마커 있음 | `deprecated` |
| registry에서 제거됨 | `retired` |

### metric-health

convergence 파이프라인의 MetricValue에서 파생.

| 조건 | 파생 상태 |
|------|----------|
| 모든 값이 임계값 이내 | `ok` |
| 어느 값이 warning 임계값 초과 | `warning` |
| 어느 값이 critical 임계값 초과 | `critical` |

소스: `convergence/src/metric-registry.ts`

### policy-candidate

decision-flow의 PolicyLearning에서 파생.

| 조건 | 파생 상태 |
|------|----------|
| `PolicyCandidate.status` 값 | 그대로 매핑 (candidate/approved/rejected/modified) |

소스: `decision-flow/src/policy-learning.ts`

## 퍼블릭 API ^api-surface

```typescript
// 개별 머신 파생
deriveDocLifecycle(frontmatter: DefFrontmatter): DocLifecycleState
deriveSpecImplState(docId: string, ctx: DeriveContext): SpecImplState
deriveConventionState(specId: string, collector: SpecCollector): ConventionState
deriveSyncState(config: DefConfig, scanResult: ScanResult): SyncState
deriveAddressState(prefix: string, version: string, gateEngine: GateEngine): AddressState
deriveVersionLifecycle(prefix: string, store: VersionLifecycleStore): VersionLifecycleState
deriveFlowState(instanceId: string, store: InstanceStore): FlowState
deriveServiceStatus(serviceId: string, catalog: Catalog): ServiceState
deriveEventStatus(eventKey: string): EventState
deriveMetricHealth(prefix: string, registry: MetricRegistry): MetricHealthState
derivePolicyState(candidateId: string): PolicyState

// 전체 파생 — 모든 엔티티 × 모든 머신
deriveAllStates(ctx: DeriveAllContext): Map<string, CompositeInstance>
```

## 파생 전략 ^intent

1. **직접 매핑**: 이미 상태 필드가 있는 경우 그대로 사용 (doc-lifecycle, version-lifecycle, decision-flow, policy-candidate)
2. **규칙 기반 추론**: 관찰 가능한 사실에서 판단 규칙 적용 (spec-impl, convention, db-sync, address-state)
3. **카탈로그 조회**: 등록/존재 여부로 판단 (service-status, event-status)
4. **메트릭 평가**: 수치 기반 임계값 비교 (metric-health)
5. **문서 그래프 기반**: anchor 하위 계약 문서에서 GateKind 자동 도출 (quality-gates)

## 품질 게이트 자동 도출 ^quality

anchor 문서(unit/module/leaf)의 하위 문서 그래프에서 계약 문서를 식별하고 GateKind를 도출하는 경로.

### 도출 프로세스

```
1. anchor 문서 ID 입력
2. contains/constrains 링크를 재귀 탐색 → 하위 문서 수집
3. scope가 interface 또는 constraint인 문서 식별 (= 계약 문서)
4. 계약 문서의 scope × aspect → GateKind 도출
5. concern tag(security, accessibility, performance) → 추가 GateKind
6. 비용 순 정렬 (static → unit → integration → system)
```

### scope × aspect → GateKind 매핑

| 계약 문서 유형 | 도출 GateKind |
|--------------|--------------|
| interface/api_contract | typecheck, api-contract |
| interface/cli_contract | typecheck, integration-test |
| interface/event_contract | typecheck, unit-test |
| constraint/tech_constraint | unit-test, static-analysis |
| constraint/biz_constraint | integration-test |
| constraint/infra_constraint | build, integration-test |

### 구조적 상태 도출

번들 내 문서 역할(concept/contract/gate/support)에서 하네스 구조 상태를 파생:

| 조건 | 파생 상태 |
|------|----------|
| concept 문서만 있음 | `concept-defined` |
| + contract 문서 있음 | `contract-bound` |
| + gate 문서 있음 | `gate-bound` |
| + 모든 gate passed | `verified` |

코드 SSOT:
- `work-domain/src/harness.ts` — buildHarnessPlan(), deriveGateKinds(), isContractDoc()
- `work-domain/src/harness-model.ts` — deriveHarnessState(), classifyHarnessDocRole()
