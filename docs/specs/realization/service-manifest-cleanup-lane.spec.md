---
def:
  id: service-manifest-cleanup-lane
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: service-manifest-assembly
      type: refines
    - target: service-release-manifest
      type: depends_on
---
# Service Manifest Cleanup Lane

## 목적 ^purpose

deprecated child component를 새 published version으로 치환하고, 기존 active manifest를 깨지 않고 정리하는 cleanup lane을 별도 운영 facet으로 고정한다.

## ^defines

- runtime resolve: manifest pin only, fallback 최소화
- warning surface: `GET /resolve/services/:serviceId/warnings`
- cleanup lane
  - `GET /resolve/services/:serviceId/cleanup-plan`
  - `POST /resolve/services/:serviceId/cleanup-draft`
  - `POST /resolve/services/:serviceId/cleanup-activate`
  - `qa-sdk service cleanup-plan|cleanup-draft|cleanup-activate|cleanup-execute`
- cleanup draft는 non-destructive다. 기존 active manifest는 유지하고 새 draft를 만든 뒤 별도 activation으로 전이한다.
- cleanup activation은 deprecated warning이 남아 있으면 차단된다.

## ^consumes

- `packages/registry-service/src/modules/resolve/resolve.service.ts`
- `packages/registry-service/src/modules/resolve/resolve.controller.ts`
- `packages/registry-service/src/modules/dashboard/dashboard.service.ts`
- `packages/cli/src/commands/service.ts`
