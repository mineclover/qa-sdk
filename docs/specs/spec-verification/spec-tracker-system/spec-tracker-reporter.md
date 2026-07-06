---
def:
  tier: component
  id: spec-tracker-reporter
  address: def_document:v2:68883
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
  - packages/spec-tracker/src/reporter.ts
  - packages/spec-tracker/src/collector.ts
  - packages/spec-tracker/src/types.ts
  - packages/spec-tracker/src/spec-tracker.test.ts
---
# Spec Tracker — 리포터

## 목적 ^purpose

수집된 ContractEvidence를 specId별로 집계하여 ContractReport와 VerificationSummary를 생성한다.

## 구성 ^overview

- `generateReport(collector, specIds?)`: 대상 specId를 지정하지 않으면 collector의 고유 specId 목록을 사용한다.
- evidence가 1건 이상 있는 specId만 `reports`에 포함한다.
- coverage는 `passed / (passed + failed)`로 계산하며 skipped evidence는 분모에서 제외한다.
- marker가 없는 evidence는 `_unmarked` marker bucket에 집계한다.
- `fullyPassed`는 failed가 0이고 passed가 1건 이상인 report만 센다.
