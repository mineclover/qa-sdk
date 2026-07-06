---
def:
  tier: component
  id: spec-tracker-vitest-adapter
  address: def_document:v2:412928
  scope: interface
  aspect: api_contract
  depth: implementation
  lifecycle: approved
  layer: mediation
  svc: spec-tracker
  tags: [testing]
  links:
    - target: spec-tracker-system
      type: refines
    - target: spec-tracker-collector
      type: depends_on
  sources:
    - packages/spec-tracker/src/vitest-adapter.ts
    - packages/spec-tracker/src/collector.ts
    - packages/spec-tracker/src/types.ts
    - packages/spec-tracker/src/index.ts
    - packages/spec-tracker/src/spec-tracker.test.ts
---
# Spec Tracker — Vitest 어댑터

## 목적 ^purpose

vitest의 테스트 실행 결과를 ContractEvidence로 수집하는 어댑터. 새 사용 경로는 `linkSpec(specId)`와 `specIt(specId, name, fn)`이며, legacy `spec(specId)` 헬퍼도 유지한다.

## 구성 ^overview

- `getGlobalCollector()`: 프로세스 전역 SpecCollector를 반환한다.
- `linkSpec(specId, collector?)`: vitest의 global `afterEach`가 있으면 파일 단위로 테스트 결과를 수집한다.
- `specIt(specId, name, fn, options?)`: 개별 테스트를 감싸고 성공/실패 evidence를 기록한다. 실패 시 vitest가 실패를 인식하도록 error를 다시 던진다.
- `spec(specId, collector?)`: legacy helper. `describe`/`it`/`marker(...).it` 형태를 제공하지만 새 코드에서는 `linkSpec` 또는 `specIt`을 우선한다.
- vitest global이 없으면 `specIt`은 함수를 직접 실행하고 결과를 collector에 기록한다.
