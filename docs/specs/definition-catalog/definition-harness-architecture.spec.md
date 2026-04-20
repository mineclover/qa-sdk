---
def:
  id: harness-architecture
  type: design
  tier: system
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [structural, entry-point]
  links:
    - target: definition-harness
      type: depends_on
    - target: definition-harness-derive
      type: contains
    - target: definition-harness-persistence
      type: contains
    - target: definition-harness-cli
      type: contains
---

## 목적 ^purpose

하네스는 **"이 코드가 지금 어떤 상태인가"를 좌표로 표현하고 추적하는 시스템**이다.

문서의 생명주기, 스펙 구현 단계, 품질 게이트 통과 여부, 서비스 건강도를 유한 상태 머신으로 모델링하고, 모든 상태 전이를 좌표 이벤트로 수집한다. 수집된 이벤트는 수렴 분석 파이프라인을 통해 패턴과 이상을 감지하고, 그 결과가 다시 다음 의사결정의 컨텍스트가 된다.

## 구성 ^overview

### 왜 하네스인가

| 질문 | 하네스 없을 때 | 하네스 있을 때 |
|------|--------------|--------------|
| 이 스펙이 구현되었나? | git log 뒤져봐야 함 | `spec-impl: verified` |
| 품질 게이트 통과했나? | CI 로그 확인 | `bundle_observation: complete` |
| 버전 릴리스 가능한가? | 체크리스트 수동 확인 | `prefix-release` 프로세스 실행 |
| 이 결정이 문서에 반영됐나? | 슬랙 검색 | `decision→doc approved` 자동 전이 |

### 2계층 구조

```
계층 1: definition-catalog (무엇이 어떤 상태인가)
  ├── 11개 상태 머신 — doc-lifecycle, spec-impl, convention, ... policy-candidate
  ├── 7개 머신 간 의존 — cascade, guard, notify
  ├── 3개 명명된 프로세스 — prefix-release, doc-approval, service-deprecation
  ├── harness-tracker — 상태 전이 → SDK 이벤트 emit
  └── harness-derive — 관찰 가능한 사실에서 상태 자동 파생

계층 2: work-domain (검증이 통과했는가)
  ├── GateKind 19종 × GateScope 7종 — 품질 게이트 택소노미
  ├── GateState 9상태 FSM — idle → ready → running → passed/failed
  ├── BundleState 6상태 — 게이트 합산 완성도
  ├── gate-tracker — 게이트 전이 → SDK 이벤트 emit
  └── HarnessPlan — 계약 문서에서 게이트 자동 도출
```

### 3가지 사용 시나리오

#### 시나리오 A: 문서 상태 추적

```
개발자가 스펙 문서 작성 → frontmatter에 lifecycle: draft
    ↓ deriveAllStates()
11개 머신 상태 자동 결정:
  doc-lifecycle: draft
  spec-impl: designed (코드 없음)
  convention: unverified (증거 없음)
  db-sync: out-of-sync (아직 동기화 안 함)
    ↓ harness-tracker
harness.transition 이벤트 emit → ingest-server 수집
```

**사용하는 코드**: CLI `qa-sdk def state <docId>`

#### 시나리오 B: 품질 게이트 실행

```
anchor 문서(unit/module) 지정
    ↓ buildHarnessPlan(anchorId, docGraph)
하위 문서에서 계약 문서 식별 (interface, constraint scope)
    ↓ deriveGateKinds(contractDoc)
scope × aspect → 필요한 GateKind 자동 도출
  예: api_contract → [typecheck, api-contract]
      tech_constraint + security tag → [unit-test, static-analysis, security-audit]
    ↓ createGateTracker({ plan, listener: gateHarnessBridge })
게이트 실행 → passed/failed → BundleState 계산
    ↓ BundleState "complete" 시
listener 호출 → convention-compliance → compliant 자동 전이
```

**사용하는 코드**: CLI `qa-sdk quality <anchorId>`

#### 시나리오 C: Cross-Loop 순환

```
⑤ 의사결정 완료 (verdict: success)
    ↓ createDecisionInfraBridge()
⑥ doc-lifecycle → approved 전이
    ↓ guard 충족
③ 품질 게이트 전체 통과
    ↓ createGateHarnessBridge()
② convention-compliance → compliant 전이
    ↓ buildHarnessContext()
⑤ 다음 의사결정 컨텍스트에 { harness_health: "healthy" } 주입
```

**guard 순서**: Decision success → Doc approved → Gate complete → Convention compliant

### 좌표 매핑

| prefix | 차원 | 관측 대상 | 이벤트 |
|--------|------|----------|--------|
| harness_transition | svc × machine × state × trigger | 11머신 전이 | harness.transition |
| harness_guard | svc × machine × state × verdict | guard 검증 | harness.guard_check |
| harness_process_step | svc × process × machine × verdict | 프로세스 스텝 | harness.process_step |
| gate_execution | svc × kind × scope × state | 게이트 FSM | gate.execution |
| bundle_observation | svc × bundle_state | 번들 완성도 | bundle.observation |

### 데이터 흐름

```
코드 상태 (관찰 사실)
    ↓ deriveAllStates() — 자동 파생 (4 전략: 직접매핑/규칙추론/Store읽기/시스템관측)
11개 머신 상태
    ↓ harness-tracker.transition() — SDK 이벤트 emit
address_context: { harness_transition: "harness_transition:v1:<addr>" }
    ↓ ingest-server (HTTP)
recordStore → convergence pipeline
    ↓ metricsToObservations()
ObservationNode (headroom, skew, 이상)
    ↓ DKG store
다음 분석의 기준선
```

### 안정성 규칙

- **fail-open**: bridge 전이 실패 → 경고 로그 + 무시. 원본 동작 차단 금지
- **guard 순서**: cascade/guard 의존이 있으므로 전이 순서가 중요. 위반 시 경고만
- **cascade 격리**: cascade 전이 실패가 원본 전이를 롤백하지 않음
- **null = 미연결**: 파생 입력이 null이면 해당 머신 skip (undefined와 다름)
- **에러 삼킴 금지**: catch 블록에서 최소 logger.log로 기록

### 관련 소스

| 파일 | 역할 |
|------|------|
| `definition-catalog/src/state-model.ts` | FSM 엔진 + 기본 4머신 |
| `definition-catalog/src/harness-state-model.ts` | 시스템 7머신 + 의존 + 프로세스 |
| `definition-catalog/src/harness-tracker.ts` | SDK 이벤트 수집 |
| `definition-catalog/src/harness-derive.ts` | 자동 파생 (4전략) |
| `definition-catalog/src/cross-loop-bridge.ts` | Cross-Loop 브릿지 (③→②→⑤→⑥) |
| `work-domain/src/harness.ts` | 게이트 FSM (순수 함수) |
| `work-domain/src/harness-model.ts` | 구조적 4단계 모델 |
| `work-domain/src/gate-kind.ts` | 19종 게이트 유형 |
| `work-domain/src/gate-tracker.ts` | 게이트 트래커 + BundleStateListener |
| `demo-snapshot/src/demo-catalog.ts` | 축/prefix SSOT |
| `event-catalog/src/prefix-mapping.ts` | 이벤트 → prefix 매핑 |
