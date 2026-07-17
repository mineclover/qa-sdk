---
def:
  id: spec-engine-system
  tier: system
  address: def_document:v2:137224
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, entry-point, cross-scope]
  links:
    - target: spec-arch-group
      type: depends_on
    - target: spec-reference-system
      type: depends_on
    - target: spec-phases-group
      type: depends_on
    - target: spec-architecture-system
      type: depends_on
    - target: prefix-guide
      type: depends_on
    - target: spec-next-phase
      type: contains
    - target: spec-core-types-group
      type: depends_on
    - target: convergence-layer-group
      type: depends_on
    - target: spec-prop-system
      type: depends_on
    - target: spec-engine-design-guide
      type: refs
sources:
  - packages/spec-core/src/index.ts
  - packages/spec-core/src/self-evaluation.test.ts
  - packages/spec-core/src/loader/catalog-bridge.ts
  - packages/spec-core/src/propagation/index.ts
  - packages/spec-schema/src/index.ts
  - packages/spec-transition/src/index.ts
---

## 목적 ^purpose

좌표 시스템의 설계 규칙, 타입, 전파, 수렴을 관리하는 스펙 엔진.

## 구성 ^overview

- `spec-arch-group`: spec-core/spec-server 구조를 계층, NestJS, 인터셉터로 분할한 그룹.
- `spec-reference-system`: 스펙 링크 규칙과 axis 판정 기준을 reference 계층으로 분리한 그룹.
- `spec-phases-group`: 구현 단계 계획을 로드맵과 선택적 확장/runtime 단계로 나눈 그룹.
- `spec-architecture-system`: 전체 시스템 구조와 시간 관계 수집 경로를 architecture 계층으로 분리한 그룹.
- `prefix-guide`: Status: DESIGN prefix가 실제로 무엇을 표현하는지, 환경 변수로 어떻게 오버라이드하는지, 비즈니스 로직의 관측 포인트를 어떻게 정의하는지.
- `spec-next-phase`: prefix의 3가지 사용 모드를 인프라로 연결하고, skills/문서 자체도 prefix 기반으로 관리하며, 이벤트 수집이 실제로 동작하는지 검증한다.
- `spec-core-types-group`: 공개 식별자/스키마와 registry/IR을 분리한 core type 그룹.
- `convergence-layer-group`: 비교 도구와 추천 도구를 분리한 수렴 계층 그룹.
- `spec-prop-system`: PrefixSpec 변경의 publish -> notify -> codegen -> DKG record 전파 그룹.
