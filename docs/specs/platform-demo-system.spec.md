---
def:
  id: platform-demo-system
  type: spec
  tier: system
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: experience
  links:
    - target: viz-system
      type: depends_on
    - target: platform-demo-api-spec
      type: depends_on
sources:
  - packages/platform-demo/src/main.ts
  - packages/platform-demo/src/registry.ts
  - packages/platform-demo/src/event-address.ts
  - packages/platform-demo/src/mock-casbin-api.ts
  - packages/platform-demo/src/mock-event-api.ts
  - packages/platform-demo/src/mock-permission-api.ts
  - packages/platform-demo/src/mock-scenario-api.ts
  - packages/platform-demo/src/mock-service-api.ts
  - packages/platform-demo/src/pages/access.ts
  - packages/platform-demo/src/pages/casbin.ts
  - packages/platform-demo/src/pages/event.ts
  - packages/platform-demo/src/pages/logging.ts
  - packages/platform-demo/src/pages/overview.ts
  - packages/platform-demo/src/pages/permission.ts
  - packages/platform-demo/src/pages/scenario.ts
  - packages/platform-demo/src/pages/service.ts
  - packages/platform-demo/src/pages/version.ts
  - packages/platform-demo/scripts/static-smoke.test.mjs
  - packages/platform-demo/scripts/mock-read-model.test.ts
  - packages/platform-demo-api/src/index.ts
  - packages/platform-demo-api/src/registry.ts
  - packages/platform-demo-api/scripts/read-api.test.ts
---
# Platform Demo System

## 목적 ^purpose

전체 시스템의 통합 데모를 위한 시나리오, API 및 환경 조립을 담당한다.

## 구성 ^overview

`@qa-sdk/platform-demo`는 좌표 시각화와 인덱싱 레이어를 브라우저에서 체험하는 Vite frontend이고, `@qa-sdk/platform-demo-api`는 demo-snapshot 카탈로그를 Cloudflare Workers/Hono API로 노출하는 backend surface다. 프론트는 정적 카탈로그 탐색과 runtime 상태 조회를 분리해, backend 비용 없이도 핵심 좌표 여정을 재현한다.

- Frontend entry: `packages/platform-demo/src/main.ts`
- Demo registry: `packages/platform-demo/src/registry.ts`
- Bundled read models: `packages/platform-demo/src/mock-*-api.ts`
- Canonical event address helper: `packages/platform-demo/src/event-address.ts`
- Static smoke: `packages/platform-demo/scripts/static-smoke.test.mjs`
- Bundled read-model smoke: `packages/platform-demo/scripts/mock-read-model.test.ts`
- API entry: `packages/platform-demo-api/src/index.ts`
- API registry: `packages/platform-demo-api/src/registry.ts`
- API smoke: `packages/platform-demo-api/scripts/read-api.test.ts`

## 경계 ^boundary

- platform-demo는 개별 기능 데모 모음이 아니라 `viz-system`과 indexing 레이어를 브라우저에서 조립하는 experience surface다.
- `demo-snapshot`이 좌표 SSOT이며, bundled read model은 service/permission/event/Casbin/scenario의 결정론적 정적 여정을 담당한다. 각 mock은 `registry.ts` response shape를 유지하고 `event-address.ts`를 통해 catalog capacity 기반 주소를 만든다.
- platform-demo-api는 grant/log/version 등 runtime 상태가 필요한 surface의 API 경계로 유지한다. API-backed surface와 bundled surface의 주소를 임의로 섞지 않는다.
- D1 grant/log mutation route와 API-backed read route는 runtime 검증 대상이고, bundled read model과 `address_context`는 package smoke로 고정한다.
