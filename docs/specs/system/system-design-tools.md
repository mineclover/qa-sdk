---
def:
  id: system-design-tools
  tier: layout
  address: def_document:v2:137228
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [structural, entry-point]
  links:
    - target: dkg-system
      type: refs
    - target: dkg-system-root
      type: refs
    - target: df-system
      type: refs
    - target: df-model-group
      type: refs
    - target: df-analysis-group
      type: refs
    - target: df-interface-group
      type: refs
    - target: df-narrative-group
      type: refs
    - target: taxonomy-boundaries
      type: refs
    - target: spec-engine-system
      type: refs
    - target: analysis-system
      type: refs
    - target: definition-catalog-spec
      type: refs
    - target: document-governance-guideline
      type: refs
    - target: prefix-catalog-system
      type: refs
    - target: qa-sdk-engine-system
      type: refs
---
# 설계 도구 계층

## 목적 ^purpose

DKG(설계 그래프), Decision Flow(의사결정), Spec Engine(설계 규칙), Analysis(관측 분석), Definition Catalog(문서 관리) — 좌표 시스템의 설계와 관측을 지원하는 도구. 각 도메인의 서브그룹 루트와 거버넌스 가이드도 함께 묶는다.

## 구성 ^overview

- DKG(설계 그래프) — dkg-system, dkg-system-root
- decision-flow(의사결정) — df-system + 서브그룹 4종 (model/analysis/interface/narrative)
- definition-catalog(문서 관리) — definition-catalog-spec, document-governance-guideline
- taxonomy-boundaries(분류 체계 경계 관리)
- spec-engine(설계 규칙)
- analysis(관측)
- prefix-catalog(도메인 prefix 카탈로그)
- qa-sdk-engine-system(추론/실행 엔진)
