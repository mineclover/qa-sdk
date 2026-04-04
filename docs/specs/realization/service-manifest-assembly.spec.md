---
def:
  id: service-manifest-assembly
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: service-release-manifest
      type: depends_on
---
# Service Manifest Assembly

## 목적 ^purpose

이미 존재하는 child component version을 선택해 deterministic한 release manifest를 조립하고, deprecated 참조를 cleanup lane으로 치환하는 실행 경로를 정의한다.

## ^defines

- assembly gate: referenced child component는 반드시 `published`
- runtime resolve: manifest pin only, fallback 최소화
- warning surface: `GET /resolve/services/:serviceId/warnings`
- cleanup lane:
  - `GET /resolve/services/:serviceId/cleanup-plan`
  - `POST /resolve/services/:serviceId/cleanup-draft`
  - `POST /resolve/services/:serviceId/cleanup-activate`
  - `qa-sdk service cleanup-plan|cleanup-draft|cleanup-activate|cleanup-execute`
- cleanup draft는 non-destructive다. 기존 active manifest는 유지하고 새 draft를 만든 뒤 별도 activation으로 전이한다.

## ^consumes

- `packages/registry-service/src/modules/manifests/manifest.service.ts`
- `packages/registry-service/src/modules/resolve/resolve.service.ts`
- `packages/cli/src/commands/service.ts`
- `packages/registry-service/src/modules/dashboard/dashboard.service.ts`
