---
def:
  id: qa-sdk-engine-system
  type: spec
  tier: system
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: engine
  tags: [structural, runtime]
  links:
    - target: spec-engine-system
      type: depends_on
    - target: analysis-system
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
    - target: dkg-system-root
      type: depends_on
    - target: df-system
      type: depends_on
    - target: gate-engine-group
      type: refs
    - target: spec-core-types-group
      type: refs
---

# QA-SDK Engine System

## 목적 ^purpose

문서 그래프 분석, 로직 매칭, 실행 제어 등 QA-SDK의 핵심 도메인 추론 및 실행 로직을 담당한다.

## 구성 ^overview

- `spec-engine-system`: 스펙 구조, reference, phase, convergence, propagation을 관리하는 설계 규칙 엔진.
- `analysis-system`: 수집된 이벤트/문서 데이터를 기반으로 수렴, 공출현, 상태 전이를 분석하는 관측 엔진.
- `definition-catalog-spec`: 문서 그래프와 definition metadata를 관리하는 정의 좌표계.
- `dkg-system-root`: 설계 지식 그래프의 노드/엣지/상태 저장/질의 경계.
- `df-system`: decision-flow 모델, 인터페이스, 분석, narrative 계층.
- `gate-engine-group`: 품질 게이트와 실행 aware query의 runtime engine.
