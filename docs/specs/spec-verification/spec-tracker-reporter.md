---
def:
  id: spec-tracker-reporter
  address: def_document:v2:68883
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
# Spec Tracker — 리포터

## 목적 ^purpose

수집된 ContractEvidence를 specId별로 집계하여 ContractReport와 VerificationSummary를 생성한다. definition-service에 결과를 전송하는 sync 기능도 제공한다.
