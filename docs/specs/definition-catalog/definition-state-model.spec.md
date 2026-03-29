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
  tags: [entry-point, tier-system]
  links:
    - target: definition-taxonomy
      type: refines
---
# Definition State Model — 유한 상태 모델

## 목적 ^purpose

문서와 시스템 프로세스를 유한 상태 머신으로 일반화한다. 상태 정의 → 전이 규칙 → 전이 조건 → 검증 → 리포트의 공통 구조를 제공하여, 하네스 인프라의 기반이 된다.

## 구성 ^overview

공통 엔진 + 4개 사전 정의 머신:

- `StateMachineDefinition` — 상태/전이/가드 정의
- `StateMachineInstance` — 엔티티별 현재 상태 + 전이 이력
- `DOC_LIFECYCLE_MACHINE` — draft → review → approved → deprecated → archived
- `SPEC_IMPL_MACHINE` — designed → implementing → implemented → verified → source-referenced
- `CONVENTION_MACHINE` — unverified → partial → compliant → violated
- `SYNC_MACHINE` — out-of-sync → syncing → synced → drift-detected

## 공통 구조 ^constraint

모든 상태 기반 프로세스는 동일한 5단계 구조를 따른다:

1. **상태 정의** — 유한한 상태 집합 (StateDefinition[])
2. **전이 규칙** — 허용된 상태 간 전이 (TransitionRule[])
3. **전이 조건** — guard 함수로 전이 가능 여부 판단
4. **검증** — 현재 상태의 유효성 + 분포 확인 (computeDistribution)
5. **리포트** — 상태 분포를 CLI/UI로 출력

## 관련 소스

- `definition-catalog/src/state-model.ts` — 엔진 + 4개 머신 정의
- `definition-catalog/src/state-model.test.ts` — 11건 테스트
