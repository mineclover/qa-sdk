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
  - packages/platform-demo/scripts/static-smoke.test.mjs
  - packages/platform-demo-api/src/index.ts
  - packages/platform-demo-api/src/registry.ts
  - packages/platform-demo-api/scripts/read-api.test.ts
---
# Platform Demo System

## 목적 ^purpose

전체 시스템의 통합 데모를 위한 시나리오, API 및 환경 조립을 담당한다.

## 구성 ^overview

`@qa-sdk/platform-demo`는 좌표 시각화와 인덱싱 레이어를 브라우저에서 체험하는 Vite frontend이고, `@qa-sdk/platform-demo-api`는 demo-snapshot 카탈로그를 Cloudflare Workers/Hono API로 노출하는 backend surface다.

- Frontend entry: `packages/platform-demo/src/main.ts`
- Demo registry: `packages/platform-demo/src/registry.ts`
- Static smoke: `packages/platform-demo/scripts/static-smoke.test.mjs`
- API entry: `packages/platform-demo-api/src/index.ts`
- API registry: `packages/platform-demo-api/src/registry.ts`
- API smoke: `packages/platform-demo-api/scripts/read-api.test.ts`

## 경계 ^boundary

- platform-demo는 개별 기능 데모 모음이 아니라 `viz-system`과 indexing 레이어를 브라우저에서 조립하는 experience surface다.
- platform-demo-api는 demo-snapshot SSOT를 service/permission/event 좌표 read API로 노출한다.
- D1 grant/log mutation route는 runtime 검증 대상이고, read-only API와 dashboard read-model은 package smoke로 고정한다.
