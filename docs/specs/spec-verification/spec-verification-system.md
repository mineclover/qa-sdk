---
def:
  id: spec-verification-system
  level: unit
  address: def_document:v2:68646
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: draft
  layer: operation
  tags: [structural, entry-point, testing, observability]
  links:
    - target: definition-service-system
      type: depends_on
    - target: spec-engine-system
      type: depends_on
    - target: spec-tracker-system
      type: contains
    - target: spec-analyzer-system
      type: contains
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
           (문서별 구현 상태 기록)
```

## 소유하지 않는 것

- 문서 메타데이터 관리 → definition-service
- 테스트 실행 → vitest
- 코드 컴파일/타입 검사 → TypeScript 컴파일러
- 문서 분류/검색/그래프 → definition-catalog
