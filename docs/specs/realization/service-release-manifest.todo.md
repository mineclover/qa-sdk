---
def:
  id: service-release-manifest
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: realization-service-control-plane
      type: depends_on
    - target: runtime-service-address
      type: depends_on
    - target: deployment-binding
      type: depends_on
---
# ServiceReleaseManifest — 잔여 구현 항목

## 목적 ^purpose

child component version과 prefix pin을 묶는 release artifact를 정의해 runtime bootstrap, deploy pipeline, CloudEvents consumer가 같은 binding을 참조하게 한다.

## 구현 항목

- [ ] `serviceUnitVersion`, `ownershipVersion`, `exposureVersion`, `deploymentVersion`, `runtimeAddress`, `prefixes`를 포함한 manifest 구조를 고정한다.
- [ ] manifest가 child snapshot 전체를 중복 저장하지 않는 원칙을 명시한다.
- [ ] `service_manifests` 스키마에 어떤 version ref와 snapshot이 필요한지 정리한다.
- [ ] CloudEvents의 `qasdk_manifestversion`이 이 artifact와 어떻게 연결되는지 규칙을 정한다.
