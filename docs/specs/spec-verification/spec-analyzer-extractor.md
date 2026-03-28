---
def:
  id: spec-analyzer-extractor
  address: def_document:v2:68880
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: draft
  layer: operation
  svc: spec-analyzer
  tags: [testing, tier-system]
  links:
    - target: spec-analyzer-system
      type: refines
    - target: spec-analyzer-types
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
---
# Spec Analyzer — 선언 추출기

## 목적 ^purpose

마크다운 문서의 계약 마커(^api-surface, ^inputs, ^outputs)에서 검증 대상 심볼(엔드포인트, 함수, 타입)을 추출한다. definition-catalog의 extractByMarker 함수를 재사용한다.
