---
def:
  id: deployment-address
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
---
# DeploymentAddress — 잔여 TODO

## 목적 ^purpose

provider/project/stack/resourceKey와 runtime target(env/region)을 결합한 배포 주소를 정의해 Pulumi 대상 식별을 완성된 주소 단위로 다룬다.

## 구현 항목

- [ ] provider별 locator metadata 규칙을 더 구체화한다.
