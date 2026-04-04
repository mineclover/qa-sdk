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
    - target: service-control-plane-surface
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
    - target: service-control-plane-cleanup-test
      type: contains
contains:
  - service-unit-spec
  - service-ownership-spec
  - service-exposure-spec
  - service-control-plane-surface
  - runtime-service-address
  - deployment-address
  - deployment-binding
  - service-release-manifest
  - service-manifest-assembly
  - service-control-plane-cleanup-test
---
# Service Control Plane

## 목적 ^purpose

runtime/deployment address system을 서비스 정의보다 상위 aggregate로 고정하고, 서비스 관련 구성요소를 독립적인 spec facet으로 분해한다. 이 문서는 child component의 경계와 조립 관계를 index/module 관점에서 안내하는 진입점이다.

## 구성 ^overview

- `service-unit-spec`: 서비스 논리 단위 정의
- `service-ownership-spec`: prefix 생산/소비 관계
- `service-exposure-spec`: gateway/routing 정책
- `service-control-plane-surface`: registry/resolve/dashboard/CLI가 노출하는 운영 surface
- `runtime-service-address`: qa-sdk 좌표계에 직접 참여하는 canonical runtime 주소
- `deployment-address`: provider/project/stack/resourceKey를 포함한 배포 주소
- `deployment-binding`: 배포 결과와 runtime overlay를 기록하는 binding
- `service-release-manifest`: child version을 묶는 release artifact
- `service-manifest-assembly`: child component를 조합해 manifest를 생성하는 규칙과 API
- `service-control-plane-cleanup-test`: cleanup lane 운영 시나리오와 검증 기준

## 운영 surface

- transport/CLI surface는 [service-control-plane-surface.spec.md](service-control-plane-surface.spec.md)로 분리한다.
- manifest 조립/검증은 [service-manifest-assembly.spec.md](service-manifest-assembly.spec.md)가, cleanup lane은 [service-manifest-cleanup-lane.spec.md](service-manifest-cleanup-lane.spec.md)가 각각 소유한다.

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
| [service-unit-spec.spec.md](service-unit-spec.spec.md) | 서비스 단위 정의 경계 |
| [service-ownership-spec.spec.md](service-ownership-spec.spec.md) | prefix 소유/소비 모델 |
| [service-exposure-spec.spec.md](service-exposure-spec.spec.md) | gateway/routing 정책 |
| [service-control-plane-surface.spec.md](service-control-plane-surface.spec.md) | registry/resolve/dashboard/CLI 운영 surface |
| [runtime-service-address.spec.md](runtime-service-address.spec.md) | runtime 주소 모델과 `ServiceBootConfig` projection |
| [deployment-address.spec.md](deployment-address.spec.md) | 배포 주소 모델과 target identity |
| [deployment-binding.spec.md](deployment-binding.spec.md) | 배포 결과 binding과 endpoint read model |
| [service-release-manifest.spec.md](service-release-manifest.spec.md) | release artifact 구조와 version ref |
| [service-manifest-assembly.spec.md](service-manifest-assembly.spec.md) | assembly facet index/module |
| [service-manifest-validation.spec.md](service-manifest-validation.spec.md) | validate/assemble contract와 semantics key |
| [service-manifest-cleanup-lane.spec.md](service-manifest-cleanup-lane.spec.md) | warning/cleanup lane contract |
| [service-control-plane-cleanup.test.md](service-control-plane-cleanup.test.md) | cleanup lane 운영 시나리오 |

## 관련 문서

- [realization-service-control-plane.plan.md](realization-service-control-plane.plan.md)
- [realization-service-control-plane.todo.md](realization-service-control-plane.todo.md)
