---
def:
  id: service-exposure-spec
  level: leaf
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
---
# ServiceExposureSpec

## 목적 ^purpose

gateway path, strip rule 같은 노출 정책을 서비스 논리 정의와 분리하여 routing/read-model surface가 독립적으로 소비할 수 있게 한다.

## ^defines

- `ServiceExposureSpec = serviceId + gatewayPath? + stripPrefix?`
- URL은 exposure가 아니라 deployment binding 또는 endpoint read model의 책임이다.
- deprecated exposure는 active manifest에 남을 수 있지만 새 assembly 후보에서는 제외된다.

## exposure 변경 → gateway rollout 연결 규칙

- **gatewayPath 변경**: 기존 path의 트래픽이 끊기므로 즉시 반영 불가. cleanup lane과 연동:
  1. 새 exposure version 발행 (새 gatewayPath)
  2. 기존 path를 deprecated warning surface에 등록
  3. `cleanup-draft` → 새 manifest에 새 exposure pin
  4. `cleanup-activate` → 기존 manifest supersede, 새 manifest active
  5. gateway 설정(nginx/envoy) 배포: 새 path 추가 → 기존 path 제거 (blue-green)
- **stripPrefix 변경**: path 유지 채로 backend에 전달되는 경로만 변경. 무중단 가능하나 backend route 일치 확인 필요
- **exposure 삭제**: gatewayPath를 null로 설정 → `service-topology` gateway 목록에서 제외. 외부 접근 차단 의도일 때만 사용
- **다중 gateway**: 하나의 서비스가 여러 gateway path를 가져야 하면 별도 endpoint read model에서 관리. exposure는 primary path만 책임

## ^consumes

- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/registry-service/src/modules/services/service-component.service.ts`
- `packages/registry-service/src/modules/resolve/resolve.service.ts`
