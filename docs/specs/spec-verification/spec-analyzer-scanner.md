---
def:
  tier: component
  id: spec-analyzer-scanner
  address: def_document:v2:68881
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
sources:
  - packages/spec-analyzer/src/scanner.ts
  - packages/spec-analyzer/src/spec-analyzer.test.ts
---
# Spec Analyzer — 코드 스캐너

## 목적 ^purpose

TypeScript 소스 파일에서 export된 심볼(function, class, interface, type)과 라우터 엔드포인트 패턴을 수집한다. AST 파싱 없이 regex 패턴 매칭으로 동작하여 빠르고 외부 의존성이 없다.
