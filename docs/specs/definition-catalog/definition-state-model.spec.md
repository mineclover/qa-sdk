---
def:
  id: definition-state-model
  level: leaf
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-service
  tags: [entry-point]
  links:
    - target: definition-catalog-spec
      type: refines
---
# Definition State Model — 유한 상태 모델

## 목적 ^purpose

문서와 시스템 프로세스를 유한 상태 머신으로 일반화한다. 상태 정의 → 전이 규칙 → 전이 조건 → 검증 → 리포트의 공통 구조를 제공하여, 하네스 인프라의 기반이 된다. 11개 머신의 **정의**(상태, 전이, 초기값)가 이 문서에 있다. 머신의 **적용**(의존, 프로세스, 수집)은 definition-harness가 담당한다.

## 정의 ^defines

- StateMachineDefinition / StateMachineInstance — 범용 FSM 엔진
- transition(), availableTransitions(), computeDistribution() — 순수 전이/검증
- 문서 계층 4개 머신 (doc-lifecycle, spec-impl, convention, db-sync)
- 시스템 계층 7개 머신 (address-state, version-lifecycle, decision-flow, service-status, event-status, metric-health, policy-candidate)

## 소비 ^consumes

- (없음 — 순수 라이브러리, 외부 의존 없음)

## 구성 ^overview

공통 엔진 + 11개 상태 머신:

- `StateMachineDefinition` — 상태/전이/가드 정의
- `StateMachineInstance` — 엔티티별 현재 상태 + 전이 이력
- 문서 계층 4개: doc-lifecycle, spec-impl, convention-compliance, db-sync
- 시스템 계층 7개: address-state, version-lifecycle, decision-flow, service-status, event-status, metric-health, policy-candidate

## 공통 구조 ^constraint

모든 상태 기반 프로세스는 동일한 5단계 구조를 따른다:

1. **상태 정의** — 유한한 상태 집합 (StateDefinition[])
2. **전이 규칙** — 허용된 상태 간 전이 (TransitionRule[])
3. **전이 조건** — guard 함수로 전이 가능 여부 판단
4. **검증** — 현재 상태의 유효성 + 분포 확인 (computeDistribution)
5. **리포트** — 상태 분포를 CLI/UI로 출력

## 문서 계층 머신 (4개) ^machines-doc

| 머신 ID | 엔티티 | 상태 | 초기 |
|---------|--------|------|------|
| `doc-lifecycle` | 문서 | draft → review → approved → deprecated → archived | draft |
| `spec-impl` | 스펙 문서 | designed → implementing → implemented → verified → source-referenced | designed |
| `convention-compliance` | 컨벤션 문서 | unverified → partial → compliant → violated | unverified |
| `db-sync` | 시스템 | out-of-sync → syncing → synced → drift-detected | out-of-sync |

## 시스템 계층 머신 (7개) ^machines-sys

| 머신 ID | 엔티티 | 상태 | 초기 |
|---------|--------|------|------|
| `address-state` | prefix 주소 | active / inactive / open / reserved | open |
| `version-lifecycle` | prefix 버전 | draft → released → active → deprecated | draft |
| `decision-flow` | 의사결정 인스턴스 | pending → active → completed / abandoned / blocked | pending |
| `service-status` | 서비스 | active → deprecated → retired | active |
| `event-status` | 이벤트 | active → deprecated → retired | active |
| `metric-health` | 메트릭 | ok → warning → critical | ok |
| `policy-candidate` | 정책 후보 | candidate → approved / rejected / modified | candidate |

## 관련 소스

- `definition-catalog/src/state-model.ts` — FSM 엔진 + 4개 기존 머신 정의
- `definition-catalog/src/harness-state-model.ts` — 11개 머신 + 의존 + 프로세스 선언
- `definition-catalog/src/state-model.test.ts` — 11건 테스트
