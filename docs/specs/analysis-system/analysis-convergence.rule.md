---
def:
  id: analysis-convergence-rule
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability]
  links:
    - target: analysis-convergence
      type: refines
---

# Convergence Pipeline — 소비 규칙

## 목적 ^purpose

convergence-pipeline을 소비할 때 확인해야 하는 타입 제약, 포트 구분, 캐스팅 규칙을 정의한다.

---

## 소비 체크리스트

- `ConvergenceFunctions`: `Catalog`, `UsageData`, `MetricValue[]`, `ObservationNode[]` 사용. **`unknown` 금지**
- `OBS-PATTERN`: DKG ObservationNode 스키마 준수 (`subjects[]`, `finding`, `intent`)
- `GraphPort` vs `ConvergenceGraphPort`: 서비스는 최소 포트, CLI는 GraphRegistry(최대)
- `as unknown as ConcreteType`: 동적 import 구조적 캐스트. **`as any` 금지**
