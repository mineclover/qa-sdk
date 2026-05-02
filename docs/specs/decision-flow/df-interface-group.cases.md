---
def:
  id: df-interface-group-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: decision-flow
  tags: [scenario, decision, interface]
  links:
    - target: df-interface-group
      type: refines
    - target: df-system
      type: depends_on
---

# DF Interface — 소비자 기대 시나리오

## 목적 ^purpose

`df-interface-group`(CLI 영속화, CLI 조회, ingest 전송)이 `df-system`에 의존할 때 기대하는 계약. 외부 인터페이스 계층은 df-system의 FlowInstance 모델과 관측 prefix를 외부 시스템(CLI, SQLite, ingest-server)으로 노출한다.

## 시나리오 1: SQLite 영속화 스키마 호환 ^overview

**전제**: `df-cli-persistence`가 SQLite 파일(`~/.qa-sdk/decision-flow.sqlite`)에 FlowInstance를 저장한다.

**동작**: `dkg decide` 명령이 신규 FlowInstance를 생성하고 저장한다.

**기대**:
- df-system `FlowInstance` 타입 필드 = SQLite 컬럼 1:1 매핑
- schema migration 파일이 `df-state-model` 변경과 동기화 (migration number = schema version)
- rollback 가능 (이전 버전 스키마에서 저장된 레코드 읽기 호환)

**실패 시 수정 대상**: `df-system`의 `df-state-model` + `df-serialization`. 타입 추가/변경 시 migration script와 함께 PR 되어야 하며, breaking change는 major version bump.

## 시나리오 2: CLI 조회 hierarchical lookup ^overview

**전제**: `df-cli-query`가 `dkg flow-schema list/show/history` 명령을 제공한다.

**동작**: 사용자가 `dkg flow-schema show <id>` 실행.

**기대**:
- df-system `ContextProvider`의 hierarchical lookup 규칙 준수 (local → global)
- 같은 ID로 여러 번 실행 → 동일 결과 (캐시는 invalidation 명시 시에만 갱신)
- 존재하지 않는 ID → exit 1 + 명시적 에러 메시지 (유사 ID 후보 제시)

**실패 시 수정 대상**: `df-system`의 `ContextProvider` 계약. lookup 순서와 fallback 규칙이 interface 계층에 명시적으로 노출되어야 한다.

## 시나리오 3: ingest 전송 fail-open ^overview

**전제**: `df-ingest-emission`이 gate 선택/플로우 완료 이벤트를 `ingest-server`로 전송한다.

**동작**: ingest-server 가용, 불가, 또는 타임아웃 상황에서 이벤트 emit.

**기대**:
- ingest-server 불가 → CLI 흐름 계속 진행 (fail-open), 로컬 SQLite에는 기록
- 타임아웃 (기본 5s, `AbortSignal.timeout`) → retry 없음, warning 로그
- 이벤트 payload가 `df-observation-space`의 prefix 스키마와 일치 (address_context 포함)

**실패 시 수정 대상**: `df-system`의 `df-ingest-emission` 스펙. 전송 실패가 사용자 결정 기록을 가로막아서는 안 된다는 원칙을 명시.

## 시나리오 4: 인스턴스 상태 전이 원자성 ^overview

**전제**: `df-state-model`이 pending → active → completed/abandoned 전이를 정의한다.

**동작**: CLI가 FlowInstance를 완료 처리한다(`completed` 전이 + verdict 기록 + ingest emit).

**기대**:
- 세 단계가 트랜잭션 내 원자적 수행 (SQLite savepoint)
- 중간 실패 시 rollback → FlowInstance 는 active 유지
- ingest emit 실패는 트랜잭션 외부 (fail-open) — 상태는 completed 지만 emit 미전송 플래그 기록

**실패 시 수정 대상**: `df-system`의 `df-state-model` + `decision-flow-store`. 상태 전이의 원자성 경계와 ingest emit의 비원자성이 명시적으로 구분되어야 한다.
