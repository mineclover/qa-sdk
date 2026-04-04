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
# DeploymentAddress — 잔여 구현 항목

## 목적 ^purpose

provider/project/stack/resourceKey와 runtime target(env/region)을 결합한 배포 주소를 정의해 Pulumi 대상 식별을 완성된 주소 단위로 다룬다.

## 구현 항목

- [ ] `DeploymentAddress`가 반드시 `RuntimeServiceAddress`를 포함하도록 타입을 고정한다.
- [ ] `env/region` 없는 deployment ref를 미완성 주소로 취급하는 규칙을 명시한다.
- [ ] Pulumi URN을 canonical address가 아닌 locator metadata로 두는 규칙을 문서화한다.
- [ ] deployment target 비교/동등성 판정 규칙을 정한다.
