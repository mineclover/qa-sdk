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
  - packages/gateway/config/env.ts
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

- Node 서버 환경변수: `packages/gateway/config/env.ts` zod 스키마 — `AUTH_MODE`(bypass·api-key·jwt·tailscale, 미지원 값은 부팅 거부), `GATEWAY_ENV`(dev·staging·prod, registry 동적 라우트 조회에 사용), `PORT`, `REGISTRY_URL`, JWKS·enrichment·Zitadel 키. 서비스 URL 키(`INGEST_URL` 등)는 `lib/route-table.ts` `GATEWAY_SERVICES`에서 파생한다.
- CF Worker는 바인딩 Env를 쓰므로 이 스키마를 거치지 않는다.

Gateway — data/domain_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
