---
def:
  id: realization-service-control-plane
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [structural, runtime, deployment, planned]
  links:
    - target: realization-registry
      type: contains
    - target: registry-services-module
      type: contains
    - target: dkg-service-topology
      type: contains
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
      type: depends_on
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

## Cleanup Rollout 운영 플레이북

### 서비스별 cleanup 실행 절차

```
1. 대상 확인
   qa-sdk service cleanup-plan <serviceId>
   → deprecated child component 목록 + 치환 후보 확인

2. Draft 생성
   qa-sdk service cleanup-draft <serviceId>
   → 기존 active manifest 유지, 새 draft manifest 생성
   → deprecated component를 최신 published version으로 치환

3. 검증
   - draft manifest의 child version 조합이 유효한지 assembly validation 통과 확인
   - deprecated warning이 모두 해소되었는지 확인 (남아 있으면 activate 차단)

4. 활성화
   qa-sdk service cleanup-activate <serviceId>
   → 기존 active → superseded, draft → active 전이
   → runtime resolve가 새 manifest를 반환하기 시작

5. 사후 검증
   - /resolve/services/<serviceId> 호출하여 새 manifest 반환 확인
   - superseded manifest는 이벤트 replay용으로 조회 가능 상태 유지
```

### 주의 사항

- cleanup draft는 **non-destructive** — 기존 active manifest를 직접 수정하지 않음
- deprecated warning이 남아 있으면 activate가 **차단됨** — warning을 먼저 해소
- 하네스 상태 연동: cleanup activate → `convention: compliant` 전이 guard 평가
- 복수 서비스 일괄 cleanup 시 의존 순서 고려 (downstream 먼저)

## 관련 문서

- [realization-service-control-plane.plan.md](realization-service-control-plane.plan.md)
