---
def:
  id: spec-architecture-system
  tier: system
  address: def_document:v2:137223
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, entry-point, cross-scope]
  links:
    - target: spec-architecture-stack
      type: contains
    - target: spec-temporal-capture
      type: contains
    - target: spec-temporal-infra
      type: contains
    - target: spec-schema
      type: contains
    - target: spec-transition
      type: contains
sources:
  - packages/spec-core/src/index.ts
  - packages/spec-core/src/loader/spec-loader.ts
  - packages/spec-core/src/loader/catalog-bridge.ts
  - packages/spec-core/src/transition/transition-pipeline.ts
  - packages/spec-schema/src/index.ts
---

# Spec Architecture 그룹

## 목적 ^purpose

spec-engine의 전체 구조와 시간 관계 수집 경로를 스택 구조, capture 모델, 인프라 요구사항 문서로 분리해 설계 지도를 단순화한다.

## 구성 ^overview

- `spec-architecture-stack`: 패키지 구성, DKG 타입, skills, convergence, SDK/CLI/store 구조를 정리한 문서.
- `spec-temporal-capture`: 시간 순서/데이터 흐름 수집과 FlowDefinition 연결을 정리한 문서.
- `spec-temporal-infra`: 구현 우선순위, 수집 인프라, 불변식을 정리한 문서.

원본: `docs/specs/spec-engine/system-architecture.md` (`spec-system-architecture`), `docs/specs/spec-engine/temporal-relations.md` (`temporal-relations`)
