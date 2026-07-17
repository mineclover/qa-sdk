---
def:
  id: spec-verification-system
  tier: layout
  address: def_document:v2:68646
  scope: feature
  aspect: analyzer_func
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point, testing, observability]
  links:
    - target: definition-service-system
      type: depends_on
    - target: spec-engine-system
      type: depends_on
    - target: spec-tracker-system
      type: refs
    - target: spec-analyzer-system
      type: refs
    - target: spec-definition-separation
      type: refs
    - target: spec-definition-merge-validation
      type: refs
sources:
  - packages/spec-analyzer/src/index.ts
  - packages/spec-analyzer/src/extractor.ts
  - packages/spec-analyzer/src/scanner.ts
  - packages/spec-analyzer/src/drift.ts
  - packages/spec-analyzer/src/spec-analyzer.test.ts
  - packages/spec-tracker/src/index.ts
  - packages/spec-tracker/src/collector.ts
  - packages/spec-tracker/src/reporter.ts
  - packages/spec-tracker/src/vitest-adapter.ts
  - packages/spec-tracker/src/spec-tracker.test.ts
  - packages/cli/src/commands/spec-drift.ts
---
# Spec Verification 시스템

## 목적 ^purpose

문서 상의 정의(spec)가 실제로 구현 완료됐는지 평가하고 관리하는 시스템. 런타임 계약 수집(spec-tracker)과 정적 코드 분석(spec-analyzer) 두 축으로 문서↔코드 정합성을 추적한다. definition-service가 문서 메타데이터를 관리한다면, 이 시스템은 "그 문서에 적힌 내용이 실제로 존재하고 동작하는가"를 답한다.

## 구성 ^overview

- `spec-tracker`: 테스트/런타임에서 계약 동작 여부를 수집하고 문서에 연결하는 런타임 수집기. "구현이 올바르게 동작하는가?"에 답한다.
- `spec-analyzer`: 코드를 분석하여 스펙 문서에 정의된 API/기능이 실제로 존재하는지 검증하는 정적 분석기. "구현이 존재하는가?"에 답한다.

## 두 패키지의 관계

```
spec-analyzer (정적)           spec-tracker (런타임)
  "문서에 뭐라고 써있는가"        "실제로 동작하는가"
  입력: markdown + TS 소스        입력: 테스트 실행 + 런타임 로그
  시점: CI / pre-commit           시점: 테스트 실행 시
         ↓                              ↓
    DriftReport                   ContractReport
         └──────────┬────────────────────┘
                    ↓
           definition-service
           (상위 adapter가 선택적으로 조합할 수 있는 문서 메타데이터 경계)
```

위 흐름은 두 검증 결과가 향후 조합될 수 있는 논리적 경계를 나타낸다. 현재 `spec-analyzer`와 `spec-tracker`의 결과를 definition graph에 자동 저장하거나 동일한 evidence 레코드로 materialize하는 구현은 없다. 현재 책임 분리는 [spec-definition-separation](spec-definition-separation.spec.md)에 고정한다.

## 소유하지 않는 것

- 문서 메타데이터 관리 → definition-service
- 테스트 실행 → vitest
- 코드 컴파일/타입 검사 → TypeScript 컴파일러
- 문서 분류/검색/그래프 → definition-catalog
