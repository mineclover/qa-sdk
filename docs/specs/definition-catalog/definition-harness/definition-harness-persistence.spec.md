---
def:
  id: definition-harness-persistence
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [runtime, observability, persistence, cross-scope]
  links:
    - target: definition-harness
      type: refines
    - target: definition-state-model
      type: depends_on
---
# Harness Persistence — 상태 인스턴스 영속화

## 목적 ^purpose

11개 머신의 StateMachineInstance를 영속화하여, 프로세스 종료 후에도 엔티티별 상태와 전이 이력을 유지한다. 두 가지 영속화 경로를 제공한다.

## 정의 ^defines

- def-config.json states 확장 스키마 (MachineEntityState)
- readMachineState() / writeMachineState() / readAllMachineStates()
- SDK 이벤트 경로 (harness-tracker → ingest → eventRecords)
- 저장 규칙 (initial 미저장, history는 이벤트 시계열)

## 소비 ^consumes

- def-config (def-config.ts) — JSON 파일 I/O
- harness-tracker (harness-tracker.ts) — 이벤트 emit

## 영속화 경로 ^overview

### 1. def-config.json (로컬 상태)

문서/버전 등 정적 엔티티의 상태를 파일에 저장. 별도 저장소 없이 기존 config 확장.

### 2. SDK 이벤트 (수집 상태)

`harness-tracker`가 emit하는 이벤트가 ingest-server를 통해 eventRecords 테이블에 저장. 시계열 분석과 convergence 파이프라인에서 활용.

## def-config.json 확장 ^inputs

```json
{
  "addressVersion": "v2",
  "prefixVersion": "v1",
  "lastSyncedAt": "...",
  "documentCount": 549,
  "checksums": { ... },
  "states": {
    "doc-lifecycle": {
      "gate-api": { "current": "approved", "updatedAt": "..." },
      "old-spec": { "current": "deprecated", "updatedAt": "..." }
    },
    "version-lifecycle": {
      "service:v2": { "current": "active", "updatedAt": "..." }
    },
    "address-state": {
      "service:v2": { "current": "active", "updatedAt": "..." }
    },
    "convention-compliance": {
      "error-handling-convention": { "current": "compliant", "updatedAt": "..." }
    }
  }
}
```

## SDK 이벤트 경로 ^outputs

```
harness-tracker.transition()
  ↓ harness.transition 이벤트 emit
  ↓ address_context: { harness_transition: "harness_transition:v1:..." }
  ↓
ingest-server POST /v1/ingest
  ↓ eventRecords 테이블 저장
  ↓
insights API GET /v1/insights/event-keys
  → harness.transition 이벤트 집계 가능
  → prefix별 상태 전이 분포 분석 가능
```

## 저장 규칙 ^constraint

- 기본 상태(initial)인 엔티티는 저장하지 않음 — 조회 시 머신 정의에서 initial 반환
- history는 저장하지 않음 — SDK 이벤트 시계열이 이력 역할
- states 섹션의 키는 `machineId → entityId → { current, updatedAt }`
- config 파일 크기가 1MB를 초과하면 warning
- 동시 쓰기 보호: 파일 잠금 또는 compare-and-swap (해시 기반)

## 품질 게이트 영속화

상세: `definition-quality-gates` 문서 참조. GateState/BundleState 값 정의 + def-config.json 확장은 해당 문서에 통합.
