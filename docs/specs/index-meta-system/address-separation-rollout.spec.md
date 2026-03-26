---
def:
  id: address-separation-rollout
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [decision]
  links:
    - target: address-spec
      type: constrains
    - target: adr-address-separation
      type: refines
---

# Address Separation ADR - 도입 시점과 후속 설계

## 목적 ^purpose

address/registry 분리가 실제로 정당화되는 시점과 분리 이후 예상 설계 변화를 정리해 도입 전략의 기준선을 제공한다.

## 언제 분리하는가

- address format이 versioned protocol이 되고, registry consumer가 브라우저/서비스/도구로 확장될 때 분리가 본격적으로 필요해진다.
- 단일 저장소 안에서만 쓰이는 초기 단계라면 과도한 추상화가 될 수 있지만, 외부 contract가 생기면 즉시 비용이 폭증한다.
- 따라서 "외부 소비자 등장"과 "프로토콜 독립 versioning"이 핵심 트리거다.

## 후속 설계

- 분리 후에는 address manager가 파싱/직렬화와 lifecycle을 책임지고, registry는 schema snapshot과 semantic metadata를 책임진다.
- 이 설계는 `address-spec`, `index-codec-spec`, address 시나리오 문서와 함께 진화해야 한다.
- 참고 구현과 통합 시나리오는 기존 ADR 원문과 `address-scenarios-group`을 함께 본다.
