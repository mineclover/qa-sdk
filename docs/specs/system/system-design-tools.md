---
def:
  id: system-design-tools
  level: group
  address: def_document:v2:137228
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [structural, entry-point]
  links:
    - target: dkg-system
      type: contains
    - target: df-system
      type: contains
    - target: taxonomy-boundaries
      type: contains
    - target: spec-engine-system
      type: contains
    - target: analysis-system
      type: contains
    - target: definition-catalog-spec
      type: contains
    - target: prefix-catalog-system
      type: contains
---
# 설계 도구 계층

## 목적 ^purpose

DKG(설계 그래프), Decision Flow(의사결정), Spec Engine(설계 규칙), Analysis(관측 분석), Definition Catalog(문서 관리) — 좌표 시스템의 설계와 관측을 지원하는 도구.

## 구성 ^overview

- DKG(설계 그래프)
- decision-flow(의사결정)
- definition-catalog(문서 관리)
- taxonomy-boundaries(분류 체계 경계 관리)
- spec-engine(설계 규칙)
- analysis(관측)
- prefix-catalog(도메인 prefix 카탈로그)
