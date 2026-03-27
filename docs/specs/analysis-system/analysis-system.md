---
def:
  id: analysis-system
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, observability, entry-point]
  links:
    - target: analysis-prefix
      type: contains
    - target: analysis-self-check
      type: contains
    - target: analysis-convergence
      type: contains
    - target: analysis-intent-link
      type: contains
    - target: analysis-cooccurrence
      type: contains
    - target: analysis-transition
      type: contains
---

# 분석 시스템

## 목적 ^purpose

수집된 이벤트 데이터를 기반으로 시스템 건강 상태, 좌표 수렴, prefix 공출현 패턴, 상태 전이를 분석하는 관측 레이어.

## 구성 ^overview

- `analysis-prefix`: 분석 시스템에서 prefix가 어떻게 분류되고, DSL Bundle/IntentLink/Domain 3개 조직 레이어 위에서 그룹핑되는지를 정의한다.
- `analysis-self-check`: 좌표 시스템의 건강 상태를 자동 점검하는 기능.
- `analysis-convergence`: prefix 간 중복이나 낭비를 감지하는 수렴 분석.
- `analysis-intent-link`: 특정 prefix들이 함께 관측되어야 하는 조건(IntentLink)을 정의하고, 위반 시 invariant violation을 감지한다.
- `analysis-cooccurrence`: 세션 단위로 어떤 prefix가 함께 나타나는지 Jaccard 분석.
- `analysis-transition`: 이벤트로 인해 엔티티의 상태가 어떻게 전이되는지를 정의하는 스펙.
