---
def:
  id: definition-harness-derive
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [runtime, observability, structural, cross-scope]
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

## 구성 ^overview

4가지 파생 전략으로 11개 머신 상태를 자동 결정한다: (A) 직접 매핑 — frontmatter lifecycle 필드를 그대로 사용, (B) 규칙 기반 추론 — svc/코드/테스트 존재 여부로 spec-impl 판단, (C) 외부 Store 읽기 — version/flow/policy 상태를 Store에서 읽음, (D) 시스템 관측 — GateEngine encode/decode 플래그로 address-state 파생. 입력이 null이면 해당 머신은 미연결로 판단하여 skip.

## 사용 맥락 ^context

CLI `qa-sdk def state --derive`나 definition-service의 sync 과정에서 호출된다. 모든 함수는 순수(I/O 금지)하므로, CLI/서비스가 입력을 수집하여 전달하는 책임을 진다.

## 정의 ^defines

- 11개 순수 derive 함수 (deriveDocLifecycle ~ derivePolicyState)
- deriveAllStates() — 전체 파생 오케스트레이터
- DeriveInputs / DerivedStates 인터페이스
- 4가지 파생 전략 (직접 매핑, 규칙 추론, Store 읽기, 시스템 관측)

## 소비 ^consumes

- frontmatter (lifecycle 필드) — doc-lifecycle 직접 매핑
- def-config (checksums) — db-sync drift 감지
- spec-tracker — convention coverage/failures
- GateEngine (index-meta) — address-state computeStateRanges
- VersionLifecycleStore (index-meta) — version status
- FlowInstance (decision-flow-store) — flow status
- MetricRegistry (convergence) — metric 값/임계값
- event-catalog — isCoreEvent, deprecated 마커

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

판별 입력: `svc` 필드, explicit `source:` code-boundary-map, spec-tracker 증거, 문서 본문 패턴 감지

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

## 품질 게이트 도출

상세: `definition-quality-gates` 문서 참조. GateKind 도출 + 구조적 상태 파생은 해당 문서에 통합.
