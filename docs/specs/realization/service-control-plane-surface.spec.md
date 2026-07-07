---
def:
  id: service-control-plane-surface
  tier: component
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: registry-services-module
      type: depends_on
sources:
  - packages/registry-service/src/modules/services/service-component.controller.ts
  - packages/registry-service/src/modules/services/service.controller.test.ts
  - packages/registry-service/src/modules/manifests/manifest.controller.ts
  - packages/registry-service/src/modules/manifests/manifest.controller.test.ts
  - packages/registry-service/src/modules/resolve/resolve.controller.ts
  - packages/registry-service/src/modules/resolve/resolve.controller.test.ts
  - packages/registry-service/src/modules/dashboard/dashboard.controller.ts
  - packages/registry-service/src/modules/dashboard/dashboard.controller.test.ts
  - packages/cli/src/commands/service.ts
  - packages/cli/src/commands/service.test.ts
---
# Service Control Plane Surface

## 목적 ^purpose

service control plane이 registry/resolve/dashboard/CLI에 어떤 운영 surface를 노출하는지 한 곳에서 고정한다. 상위 module 문서는 구조를 설명하고, 이 문서는 실제 진입점과 응답 성격을 정리한다.

## ^defines

- child component version surface
  - `PUT /api/services/:serviceId/components/:kind/:version`
  - `POST /api/services/:serviceId/components/:kind/:version/transition`
  - `GET /api/services/:serviceId/components/:kind`
  - `GET /api/services/:serviceId/components/:kind/published`
- ownership/topology alignment surface
  - `GET /api/services/:serviceId/ownership/topology`
  - `qa-sdk service ownership-topology <serviceId> [--version <ver>] [--json]`
  - 응답은 `matching`, `onlyInComponent`, `onlyInTopology`, `conflictingOwners`를 분리해 drift를 노출한다.
- sync write surface
  - `POST /api/services/:serviceId/runtime-addresses/sync`
  - `POST /api/services/:serviceId/deployments/sync`
  - sync 응답은 draft child component를 upsert하고 `manifestImpact(status, action, activeManifestVersion, pinned*Version?)`를 함께 반환한다.
- assembly/read surface
  - `GET /api/services/:serviceId/assembly-candidates`
  - `POST /manifests/validate`
  - `POST /manifests/assemble`
  - `GET /resolve/services/:serviceId`
- warning/cleanup surface
  - `GET /resolve/services/:serviceId/warnings`
  - `GET /resolve/services/:serviceId/cleanup-plan`
  - `POST /resolve/services/:serviceId/cleanup-draft`
  - `POST /resolve/services/:serviceId/cleanup-activate`
  - `qa-sdk service cleanup-plan|cleanup-draft|cleanup-activate|cleanup-execute`
- dashboard mirror surface
  - `GET /api/dashboard/service-control-plane/:serviceId/candidates`
  - `GET /api/dashboard/service-control-plane/:serviceId/warnings`
  - `GET /api/dashboard/service-control-plane/:serviceId/cleanup-plan`

## ^consumes

- `packages/registry-service/src/modules/services/service-component.controller.ts`
- `packages/registry-service/src/modules/manifests/manifest.controller.ts`
- `packages/registry-service/src/modules/resolve/resolve.controller.ts`
- `packages/registry-service/src/modules/dashboard/dashboard.controller.ts`
- `packages/cli/src/commands/service.ts`
