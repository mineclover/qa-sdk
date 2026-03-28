---
def:
  id: spec-tracker-types
  address: def_document:v2:342203
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: operation
  svc: spec-tracker
  tags: [testing, tier-system]
  links:
    - target: spec-tracker-system
      type: refines
---
# Spec Tracker — 핵심 타입

## 목적 ^purpose

ContractEvidence(증거 1건), ContractReport(specId별 집계), VerificationSummary(전체 요약)의 3계층 타입을 정의한다. 수집기, 리포터, 어댑터가 이 타입을 공유한다.
