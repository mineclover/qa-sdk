---
def:
  id: spec-analyzer-types
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: operation
  svc: spec-analyzer
  tags: [testing, tier-system]
  links:
    - target: spec-analyzer-system
      type: refines
---
# Spec Analyzer — 핵심 타입

## 목적 ^purpose

DeclaredSymbol(문서에서 추출한 선언), ImplementedSymbol(코드에서 발견한 구현), DriftReport(gap 분석 결과)의 3계층 타입을 정의한다. extractor, scanner, drift 모듈이 공유한다.
