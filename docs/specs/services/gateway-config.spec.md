---
def:
  tier: component
  id: gateway-config
  address: def_document:v2:342024
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: gateway
  tags: [planned]
  links:
    - target: gateway-service-spec
      type: refines
sources:
  - packages/gateway/worker.ts
  - packages/gateway/wrangler.toml
  - packages/gateway/tunnel.yml
  - simulations/enterprise-pm/services/gateway/src/config/env.ts
  - simulations/enterprise-pm/services/gateway/src/config/env.test.ts
  - simulations/enterprise-pm/services/gateway/src/routing/routing-table.ts
  - simulations/enterprise-pm/services/gateway/src/routing/routing-table.test.ts
---
# Gateway — data/domain_data

## 목적 ^purpose

게이트웨이 라우팅 설정. 서비스별 경로 매핑, strip prefix 규칙, 타임아웃.

## 구성 ^overview

Gateway — data/domain_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
