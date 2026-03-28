---
def:
  id: spec-tracker-vitest-adapter
  address: def_document:v2:412928
  scope: interface
  aspect: api_contract
  depth: implementation
  lifecycle: draft
  layer: mediation
  svc: spec-tracker
  tags: [testing, tier-system]
  links:
    - target: spec-tracker-system
      type: refines
    - target: spec-tracker-collector
      type: depends_on
---
# Spec Tracker — Vitest 어댑터

## 목적 ^purpose

vitest의 describe/it을 래핑하여 테스트 실행 결과를 자동으로 ContractEvidence로 수집하는 어댑터. `spec(specId)` 헬퍼 하나로 테스트↔문서 연결을 선언한다.
