---
def:
  tier: component
  id: gateway-routing
  address: def_document:v2:68632
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: gateway
  tags: [planned]
  links:
    - target: gateway-service-spec
      type: refines
sources:
  - packages/gateway/worker.ts
  - simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts
  - simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.test.ts
  - simulations/enterprise-pm/services/gateway/src/routing/route-decision.ts
  - simulations/enterprise-pm/services/gateway/src/routing/route-decision.test.ts
  - simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.ts
  - simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.test.ts
  - simulations/enterprise-pm/services/gateway/src/routing/integration.test.ts
---
# Gateway — feature/func_def

## 목적 ^purpose

API 라우팅 로직. path prefix strip, 서비스 디스패치, 헬스체크 프로빙.

## 구성 ^overview

Gateway — feature/func_def의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
