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
  - packages/gateway/server.ts
  - packages/gateway/lib/route-table.ts
  - packages/gateway/scripts/route-table.test.ts
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

- 라우팅 테이블 정본: `packages/gateway/lib/route-table.ts` `GATEWAY_ROUTES` — Node `server.ts`와 CF `worker.ts`가 공유한다. registry `/api/services/gateway` 동적 라우트도 같은 매칭 함수(`matchRoute`, 세그먼트 경계·최장 접두사)를 쓴다.
- strip 규칙: 서비스 라우트가 접두사를 포함하면 strip하지 않는다 (gate `/gate/check`, decode `/decode/batch`, query `/state`, registry `/metrics`). strip은 게이트웨이 별칭(`/query/*`, `/definitions/*`, `/def/*`, `/decisions/*`)에만 쓴다. registry seed(`core/seed-config.ts`)의 `stripPrefix`도 같은 규칙을 따른다.

Gateway — feature/func_def의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
