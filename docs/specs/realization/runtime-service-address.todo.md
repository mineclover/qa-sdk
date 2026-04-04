---
def:
  id: runtime-service-address
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: realization-service-control-plane
      type: depends_on
---
# RuntimeServiceAddress — 잔여 TODO

## 목적 ^purpose

`service` prefix와 `svc_ref` 참조의 canonical source가 되는 runtime 주소를 정의하고, `ServiceBootConfig`가 이 주소의 projection임을 고정한다.

## 구현 항목

- [ ] runtime address version bump 정책을 별도 운영 규칙으로 고정한다.
