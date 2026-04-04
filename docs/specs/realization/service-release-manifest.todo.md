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
# ServiceReleaseManifest — 잔여 TODO

## 목적 ^purpose

child component version과 prefix pin을 묶는 release artifact를 정의해 runtime bootstrap, deploy pipeline, CloudEvents consumer가 같은 binding을 참조하게 한다.

## 구현 항목

- [ ] CloudEvents `qasdk_manifestversion` 사용 규칙을 운영 플레이북까지 연결한다.
