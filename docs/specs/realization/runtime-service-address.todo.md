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
# RuntimeServiceAddress — 잔여 구현 항목

## 목적 ^purpose

`service` prefix와 `svc_ref` 참조의 canonical source가 되는 runtime 주소를 정의하고, `ServiceBootConfig`가 이 주소의 projection임을 고정한다.

## 구현 항목

- [x] `RuntimeServiceAddress = serviceId + namespace/name/env/region` 구조를 타입으로 고정한다.
- [ ] `ServiceBootConfig`와 1:1 projection 관계를 명시한다.
- [ ] `service` prefix 인코딩에 필요한 최소 필드를 검증 규칙으로 정한다.
- [ ] runtime address version surface가 필요한지와 필요하다면 언제 증가하는지 규칙을 정한다.
