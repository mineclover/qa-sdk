---
def:
  id: address-separation-decision
  address: def_document:v1:2137
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [decision]
  links:
    - target: index-codec-spec
      type: constrains
    - target: adr-address-separation
      type: refines
---

# Address Separation ADR - 결정과 근거

## 목적 ^purpose

address와 registry 책임을 분리해야 하는 맥락, 핵심 결정, 정당화 근거를 제약 문서 형태로 정리한다.

## 결정

- 주소 포맷 관리와 registry 메타데이터 관리는 같은 변경 속도를 가지지 않으므로 별도 레이어로 다뤄야 한다.
- 분리하지 않으면 decode, schema evolution, consumer ergonomics가 한 클래스에 과도하게 결합된다.
- 따라서 address protocol은 독립 수명주기를 가져야 하고, registry는 의미/버전 관리에 집중해야 한다.

## 근거

- 가장 큰 근거는 외부 시스템 통합과 versioned protocol 관리 비용을 줄이는 데 있다.
- codec이나 resolver가 address 정책까지 떠안으면 변경 반경이 너무 넓어진다.
- 도입 시점과 후속 설계는 `address-separation-rollout`에서 이어진다.
