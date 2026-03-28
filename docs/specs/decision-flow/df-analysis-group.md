---
def:
  id: df-analysis-group
  address: def_document:v1:536
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [structural, decision]
  links:
    - target: df-vector-analysis
      type: contains
    - target: df-time-analysis
      type: contains
    - target: df-causal-mapping
      type: contains
---
# Decision Flow 분석 기능

## 목적 ^purpose

의사결정 벡터 비교, 시간적 패턴 분석, 인과 관계 매핑 — 과거 결정에서 인사이트를 추출하는 분석 계층.

## 구성 ^overview

- `df-vector-analysis`: 의사결정 벡터 간 유사도, 분기점, 직교성 검증.
- `df-time-analysis`: 시간 범위 분석, 결정 속도 추이, 반복 패턴 감지.
- `df-causal-mapping`: X(비즈니스 요구) ↔ Y(기술 구현) 인과 증명 경로.
