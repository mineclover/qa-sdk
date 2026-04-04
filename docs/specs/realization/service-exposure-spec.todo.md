---
def:
  id: service-exposure-spec
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  links:
    - target: realization-service-control-plane
      type: depends_on
    - target: registry-services-module
      type: depends_on
---
# ServiceExposureSpec — 잔여 구현 항목

## 목적 ^purpose

gateway path, strip rule 같은 노출 정책을 서비스 논리 정의와 분리하여 routing/read-model surface가 독립적으로 소비할 수 있게 한다.

## 구현 항목

- [ ] `gatewayPath`, `stripPrefix`를 `ServiceExposureSpec`으로 분리한다.
- [ ] URL과 exposure policy의 경계를 명확히 정한다.
- [ ] gateway read model이 이 spec만으로 필요한 정책을 읽을 수 있게 surface를 정리한다.
- [ ] exposure 변경이 `exposureVersion` 증가로 이어지는 규칙을 정한다.
