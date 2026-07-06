---
def:
  tier: component
  id: spec-tracker-collector
  address: def_document:v2:68882
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: spec-tracker
  tags: [testing]
  links:
    - target: spec-tracker-system
      type: refines
    - target: spec-tracker-types
      type: depends_on
  sources:
    - packages/spec-tracker/src/collector.ts
    - packages/spec-tracker/src/types.ts
    - packages/spec-tracker/src/spec-tracker.test.ts
---
# Spec Tracker — 수집기

## 목적 ^purpose

테스트 실행과 런타임 로깅에서 ContractEvidence를 수집하는 인메모리 수집기. 증거는 readonly 타입으로 기록되고, 실행 종료 시 reporter로 전달된다.

## 구성 ^overview

- `record(input)`: status/specId를 받아 ContractEvidence를 만들고, source 기본값을 `test`, timestamp를 현재 ISO 시각으로 채운다.
- `all()`: 수집된 전체 evidence를 readonly 배열로 반환한다.
- `bySpec(specId)`: 특정 specId의 evidence만 필터링한다.
- `specIds()`: 수집된 evidence의 고유 specId 목록을 반환한다.
- `count()`/`clear()`: 수집 개수 조회와 명시적 초기화를 제공한다.
