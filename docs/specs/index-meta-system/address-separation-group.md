---
def:
  id: address-separation-group
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  svc: index-meta
  tags: [structural, decision]
  links:
    - target: address-separation-decision
      type: contains
    - target: address-separation-rollout
      type: contains
---

# Address Separation ADR 그룹

## 목적 ^purpose

address/registry 분리 ADR을 결정 근거와 도입 시점/후속 설계로 나눠 변경 판단과 이행 전략을 분리해 기록한다.

## 구성 ^overview

- `address-separation-decision`: 맥락, 결정, 근거를 정리한 문서.
- `address-separation-rollout`: 분리가 필요한 시점, 예상 설계, 참고 구현을 정리한 문서.

원본: `docs/specs/indexing/index-meta/adr-address-separation.md` (`adr-address-separation`)
