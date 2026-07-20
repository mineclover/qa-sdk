---
def:
  id: prefix-guide
  type: knowledge
  knowledge_kind: guide
  tier: system
  address: def_document:v2:136195
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [entry-point]
  links:
    - target: convergence-layer-group
      type: traces_to
    - target: prefix-guide-modeling
      type: contains
    - target: prefix-guide-env-override
      type: contains
    - target: prefix-guide-observation-point
      type: contains
    - target: prefix-guide-deploy-pattern
      type: contains
    - target: spec-architecture-system
      type: depends_on
sources:
  - packages/spec-core/src/loader/catalog-bridge.ts
  - packages/spec-core/src/loader/catalog-bridge.test.ts
  - packages/cli/src/commands/prefix-stamp.ts
  - packages/demo-snapshot/src/demo-catalog.ts
---

# Prefix 실용 가이드 — 페이지, API, 환경, 관측 포인트

## 목적 ^purpose

prefix가 실제로 무엇을 표현하는지,
환경 변수로 어떻게 오버라이드하는지,
비즈니스 로직의 관측 포인트를 어떻게 정의하는지.

## 참조

기반: [decision-standard.md](../decision-flow/decision-standard-group.md) · [spec-engine-system.md](spec-engine-system.md)

## 구성 ^overview

- [prefix-guide-modeling](prefix-guide-modeling.md): 페이지, API, 이벤트, 권한처럼 의사결정이 필요한 교차점을 prefix로 모델링하는 기준과 카테고리별 분류를 설명한다.
- [prefix-guide-env-override](prefix-guide-env-override.md): QA_ENV, QA_REGION, QA_SERVICE, QA_NAMESPACE를 SDK 부트 시 주입하는 패턴과 PartialBinder 연동을 정리한다.
- [prefix-guide-observation-point](prefix-guide-observation-point.md): 흐름의 분기점을 prefix 주소로 정의하고 권한 및 이벤트와 함께 추적하는 방법을 설명한다.
- [prefix-guide-deploy-pattern](prefix-guide-deploy-pattern.md): dev, test, prod 리전별로 같은 코드가 다른 주소를 생성하는 배포 예시를 보여준다.
