---
def:
  tier: component
  id: spec-analyzer-extractor
  address: def_document:v2:68880
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: spec-analyzer
  tags: [testing]
  links:
    - target: spec-analyzer-system
      type: refines
    - target: spec-analyzer-types
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
sources:
  - packages/spec-analyzer/src/extractor.ts
  - packages/spec-analyzer/src/spec-analyzer.test.ts
---
# Spec Analyzer — 선언 추출기

## 목적 ^purpose

마크다운 문서의 계약 마커(^api-surface, ^inputs, ^outputs) 섹션에 있는 TypeScript 코드 블록에서 검증 대상 심볼(엔드포인트, 함수, 타입, 클래스)을 추출한다. 현재 구현은 definition-catalog 런타임 함수 호출 없이, 마커 섹션과 코드 블록을 직접 파싱한다.
