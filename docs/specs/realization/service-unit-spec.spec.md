---
def:
  id: service-unit-spec
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: realization-service-control-plane
      type: refines
---
# ServiceUnitSpec

## 목적 ^purpose

서비스를 하나의 논리 단위로 식별하는 최소 정의를 고정한다. 주소, ownership, 노출 정책, 배포 결과와 섞지 않고 서비스 그 자체에 해당하는 필드만 다룬다.

## ^defines

- `ServiceUnitSpec = serviceId + namespace + name + tier + team + applicationId + attributes`
- `ServiceRecord`에서 서비스 논리 단위에 해당하는 필드를 분리한 child component다.
- `serviceId`는 stable join key이고 `namespace/name`은 runtime address projection 입력이다.

## serviceUnitVersion 운영 규칙

- **형식**: `su-<N>` (monotonic increment, e.g. `su-1`, `su-2`)
- **bump 기준**: `ServiceUnitSpec`의 필드(tier, team, applicationId, attributes)가 변경될 때 새 version 발행
- **namespace/name 변경**: 주소 축에 영향 → `runtimeAddressVersion`도 함께 bump 필수
- **serviceId 변경 금지**: stable join key이므로 rename 시 새 서비스 생성 + 기존 서비스 deprecate
- **자동 bump**: `service-control-plane.ts`의 `splitServiceRecord`가 unit을 추출할 때 version은 외부 입력. CLI `qa-sdk service update`가 변경 감지 시 version string을 자동 증분하는 것이 권장 패턴
- **manifest 연동**: `ManifestAssemblyRequest.serviceUnitVersion`에 pin. 이전 manifest의 unit version과 비교하여 changelog에 diff를 기록

## ^consumes

- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/registry-service/src/modules/services/service-control-plane.ts`
- `packages/registry-service/src/modules/services/service-component.service.ts`
