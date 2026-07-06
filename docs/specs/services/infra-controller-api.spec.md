---
def:
  tier: component
  id: infra-controller-api
  address: def_document:v2:412679
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-controller
  tags: [external]
  links:
    - target: infra-controller-spec
      type: refines
sources:
  - simulations/enterprise-pm/services/canary-controller/src/admin/compose-proxy.controller.ts
  - simulations/enterprise-pm/services/canary-controller/src/admin/compose-proxy.controller.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/admin/scale.controller.ts
  - simulations/enterprise-pm/services/canary-controller/src/admin/scale.controller.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/fault/admin-fault.controller.ts
  - simulations/enterprise-pm/services/canary-controller/src/fault/admin-fault.controller.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.controller.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.controller.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/alerts-audit-catalog.controller.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/alerts-audit-catalog.controller.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/health/health.controller.ts
---
# Infra Controller — interface/api_contract

## 목적 ^purpose

인프라 컨트롤러 API. 배포 트리거, 헬스 보고, 패턴 감지 결과 조회.

## 구성 ^overview

Infra Controller — interface/api_contract의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
