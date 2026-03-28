---
def:
  id: spec-tracker-collector
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: draft
  layer: operation
  svc: spec-tracker
  tags: [testing, tier-system]
  links:
    - target: spec-tracker-system
      type: refines
    - target: spec-tracker-types
      type: depends_on
---
# Spec Tracker — 수집기

## 목적 ^purpose

테스트 실행과 런타임 로깅에서 ContractEvidence를 수집하는 인메모리 수집기. 수집된 증거는 불변이며, 실행 종료 시 reporter로 전달된다.
