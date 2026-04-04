# Service Control Plane — 방향 계획

## 현재 목표

1. `registry-service`를 service control plane으로 확장하되, 루트를 서비스 정의가 아니라 `runtime/deployment address system`으로 고정한다.
2. 서비스 관련 surface를 child component로 분해해 각각 단독 소비 가능하게 만든다.
3. child component version 조합으로 deterministic한 release manifest를 조립하는 규칙을 만든다.

## 장기 목표

1. Pulumi 같은 배포 시스템은 qa-sdk의 service definition SSOT가 아니라 deployment binding consumer/provider로만 동작하게 한다.
2. `ServiceBootConfig`는 계속 유지하되 `RuntimeServiceAddress`의 projection으로 수렴시킨다.
3. draft 정리가 끝나면 `{id}.spec.md`는 index/module 역할을 맡고, leaf spec은 facet별로 분리한다.

## 핵심 구조

### Root Aggregate

```ts
interface ServiceAddressAggregate {
  serviceId: string;
  unit: ServiceUnitSpec;
  ownership: ServiceOwnershipSpec;
  exposure?: ServiceExposureSpec;
  runtimeAddresses: RuntimeServiceAddress[];
  deployments: DeploymentBinding[];
  releases: ServiceReleaseManifest[];
}
```

### Child Components

- `ServiceUnitSpec` — 서비스 논리 단위 정의
- `ServiceOwnershipSpec` — prefix 생산/소비 관계
- `ServiceExposureSpec` — gateway/routing 정책
- `RuntimeServiceAddress` — qa-sdk 좌표계 주소
- `DeploymentBinding` — Pulumi/stack 기준 배포 결과 바인딩
- `ServiceReleaseManifest` — child version들을 묶는 release artifact

### Assembly Principle

manifest는 child component snapshot 덩어리가 아니라, 아래 입력을 조합한 결과물이다.

```ts
interface ManifestAssemblyRequest {
  serviceId: string;
  runtimeAddressVersion: string;
  serviceUnitVersion: string;
  ownershipVersion: string;
  exposureVersion?: string;
  deploymentVersion?: string;
  prefixes: Record<string, string>;
  manifestVersion: string;
}
```

## spec 승격 방향

spec로 승격할 때는 하나의 큰 leaf로 두지 않고 index/module + leaf 조합으로 가는 것이 맞다.

### index 후보

- `realization-service-control-plane.spec.md`
  - 역할: 전체 구조/조립 관계/contains 링크를 담는 index/module

### module/leaf 후보

- `service-unit-spec.spec.md`
- `service-ownership-spec.spec.md`
- `service-exposure-spec.spec.md`
- `service-control-plane-surface.spec.md`
- `runtime-service-address.spec.md`
- `deployment-address.spec.md`
- `deployment-binding.spec.md`
- `service-release-manifest.spec.md`
- `service-manifest-assembly.spec.md` (module)
- `service-manifest-validation.spec.md`
- `service-manifest-cleanup-lane.spec.md`

## 단계

| 단계 | 내용 | 전제 |
|------|------|------|
| 1 | 현재 `ServiceRecord`를 child component로 분해 | 주소 aggregate vocabulary 고정 |
| 2 | component별 version surface 정의 | child component 경계 확정 |
| 3 | `DeploymentBinding`과 endpoint read model 관계 정리 | Pulumi sync payload 경계 확정 |
| 4 | manifest assembly API와 validation 규칙 정의 | component version ref 존재 |
| 5 | resolve API와 SDK projection 연결 | assembly artifact 정의 완료 |
| 6 | spec 승격 시 index/module + leaf 문서 체계로 전환 | TODO 소진, 구조 안정화 |

## 승격 조건

- child component 경계가 코드 타입과 저장 모델에 반영됨
- `assemble` API가 deterministic manifest를 생성함
- `resolve`가 deployment target 기준 read-model을 제공함
- local dev가 기존 `ServiceBootConfig` 경로로 계속 동작함
