---
def:
  id: viz-language-system
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  tags: [structural, tier-frontend]
  links:
    - target: rlsc-core-model
      type: contains
    - target: rlsc-integration
      type: contains
    - target: motion-content-contract
      type: contains
---

# Viz 언어 계약 그룹

## 목적 ^purpose

RLSC와 motion-content 계약을 핵심 모델, 좌표계 통합, 런타임 경계 문서로 분리해 선언형 UI 언어 계층을 정리한다.

## 구성 ^overview

- `rlsc-core-model`: RLSC의 정체성, 핵심 개념, 마크업 포맷을 정리한 문서.
- `rlsc-integration`: context engineering, 기존 좌표계 통합, API/패키지 구조를 정리한 문서.
- `motion-content-contract`: motion-content 스택의 용어집, 패키지 경계, done definition을 정리한 문서.

원본: `docs/specs/rlsc/rlsc.spec.md` (`rlsc-spec`), `docs/specs/motion-content/v1-glossary-and-contracts.md` (`motion-content-glossary`)
