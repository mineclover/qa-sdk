---
def:
  id: realization-service-control-plane
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [structural, runtime, deployment, planned]
  links:
    - target: realization-registry
      type: depends_on
    - target: registry-services-module
      type: depends_on
    - target: dkg-service-topology
      type: depends_on
    - target: meta-semantic-event-standard
      type: refines
    - target: service-unit-spec
      type: contains
    - target: service-ownership-spec
      type: contains
    - target: service-exposure-spec
      type: contains
    - target: runtime-service-address
      type: contains
    - target: deployment-address
      type: contains
    - target: deployment-binding
      type: contains
    - target: service-release-manifest
      type: contains
    - target: service-manifest-assembly
      type: contains
contains:
  - service-unit-spec
  - service-ownership-spec
  - service-exposure-spec
  - runtime-service-address
  - deployment-address
  - deployment-binding
  - service-release-manifest
  - service-manifest-assembly
---
# Service Control Plane

## 목적 ^purpose

runtime/deployment address system을 서비스 정의보다 상위 aggregate로 고정하고, 서비스 관련 구성요소를 독립적인 spec facet으로 분해한다. 이 문서는 child component의 경계와 조립 관계를 index/module 관점에서 안내하는 진입점이다.

## 구성 ^overview

- `service-unit-spec`: 서비스 논리 단위 정의
- `service-ownership-spec`: prefix 생산/소비 관계
- `service-exposure-spec`: gateway/routing 정책
- `runtime-service-address`: qa-sdk 좌표계에 직접 참여하는 canonical runtime 주소
- `deployment-address`: provider/project/stack/resourceKey를 포함한 배포 주소
- `deployment-binding`: 배포 결과와 runtime overlay를 기록하는 binding
- `service-release-manifest`: child version을 묶는 release artifact
- `service-manifest-assembly`: child component를 조합해 manifest를 생성하는 규칙과 API

## 운영 surface

- child component version API
  - `PUT /api/services/:serviceId/components/:kind/:version`
  - `POST /api/services/:serviceId/components/:kind/:version/transition`
- assembly candidate API
  - `GET /api/services/:serviceId/components/:kind/published`
  - `GET /api/services/:serviceId/assembly-candidates`
  - 후보 응답은 `published`, `excluded(reason)`, `readiness.ready` / `missingRequired`, 상태별 `summary`를 함께 제공한다.
- release resolve API
  - `GET /resolve/services/:serviceId`
- warning surface
  - `GET /resolve/services/:serviceId/warnings`
  - `GET /api/dashboard/service-control-plane/:serviceId/warnings`
  - warning 응답은 `warnings[]` 외에 `summary.total`, `summary.deprecatedReferences`, `summary.byKind`를 포함한다.
- cleanup lane
  - `GET /resolve/services/:serviceId/cleanup-plan`
  - `POST /resolve/services/:serviceId/cleanup-draft`
  - `POST /resolve/services/:serviceId/cleanup-activate`
  - cleanup은 active manifest를 직접 수정하지 않고 draft를 만든 뒤 별도 activation으로 전이한다.

## 분해 원칙

- 루트는 `ServiceDefinition` 단일 객체가 아니라 `ServiceAddressAggregate`다.
- 각 child component는 단독 소비 가능해야 한다.
- manifest는 child snapshot 덩어리가 아니라 child version을 조합한 binding artifact다.
- `ServiceBootConfig`는 `RuntimeServiceAddress`의 projection으로 유지한다.
- child component lifecycle은 governance-only다.
- runtime resolve는 manifest pin만 읽고 lifecycle이나 deployment target으로 자동 선택하지 않는다.

## 문서 맵

| 문서 | 역할 |
|------|------|
| [service-unit-spec.todo.md](service-unit-spec.todo.md) | 서비스 단위 정의 경계와 잔여 구현 |
| [service-ownership-spec.todo.md](service-ownership-spec.todo.md) | prefix 소유/소비 모델과 잔여 구현 |
| [service-exposure-spec.todo.md](service-exposure-spec.todo.md) | gateway/routing 정책과 잔여 구현 |
| [runtime-service-address.todo.md](runtime-service-address.todo.md) | runtime 주소 모델과 `ServiceBootConfig` projection |
| [deployment-address.todo.md](deployment-address.todo.md) | 배포 주소 모델과 target identity |
| [deployment-binding.todo.md](deployment-binding.todo.md) | 배포 결과 binding과 endpoint read model |
| [service-release-manifest.todo.md](service-release-manifest.todo.md) | release artifact 구조와 version ref |
| [service-manifest-assembly.todo.md](service-manifest-assembly.todo.md) | assembly contract, validation, resolve API |

## 관련 문서

- [realization-service-control-plane.plan.md](realization-service-control-plane.plan.md)
- [realization-service-control-plane.todo.md](realization-service-control-plane.todo.md)
