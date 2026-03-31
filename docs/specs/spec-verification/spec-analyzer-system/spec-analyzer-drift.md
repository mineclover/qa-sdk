---
def:
  id: spec-analyzer-drift
  address: def_document:v2:68879
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
    - target: spec-analyzer-extractor
      type: depends_on
    - target: spec-analyzer-scanner
      type: depends_on
---
# Spec Analyzer — Drift 분석기

## 목적 ^purpose

추출된 선언(DeclaredSymbol)과 스캔된 구현(ImplementedSymbol)을 매칭하여 DriftReport를 생성한다. missing(문서 O, 코드 X)과 undocumented(코드 O, 문서 X)를 식별한다.
