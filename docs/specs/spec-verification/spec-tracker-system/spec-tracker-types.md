---
def:
  tier: component
  id: spec-tracker-types
  address: def_document:v2:342203
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-tracker
  tags: [testing]
  links:
    - target: spec-tracker-system
      type: refines
sources:
  - packages/spec-tracker/src/types.ts
  - packages/spec-tracker/src/index.ts
  - packages/spec-tracker/src/spec-tracker.test.ts
---
# Spec Tracker — 핵심 타입

## 목적 ^purpose

ContractEvidence(증거 1건), ContractReport(specId별 집계), VerificationSummary(전체 요약)의 3계층 타입을 정의한다. 수집기, 리포터, 어댑터가 이 타입을 공유한다.

## 구성 ^overview

- `ContractEvidence`: `specId`, marker, pass/fail/skip 상태, test/runtime 출처, 테스트 파일/이름, duration, error, timestamp를 담는 단일 증거.
- `ContractReport`: 단일 specId의 evidence 수, pass/fail/skip 수, marker별 집계, coverage, lastVerified를 담는 집계 결과.
- `VerificationSummary`: report 배열과 전체 spec 수, 검증된 spec 수, 완전 통과 spec 수, 생성 시각을 담는 최상위 요약.
- `ContractMarkerKind`는 definition-catalog의 계약 marker vocabulary와 맞춘다.
