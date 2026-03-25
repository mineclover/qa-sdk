---
def:
  id: rlsc-core-model
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: rlsc-spec
      type: refines
---

# RLSC 핵심 모델

## 목적 ^purpose

RLSC의 정체성, 핵심 개념, 마크업 포맷을 분리해 시각 구조 DSL이 무엇을 표현하는지 명확히 한다.

## 핵심 모델

- RLSC는 레이아웃, 계층, role을 좌표처럼 다루는 시각 구조 DSL이다.
- 마크업 포맷은 검색, 대치, 생성이 가능하도록 사람이 읽는 구조와 기계 변환 구조를 함께 가진다.
- DOM 자체를 복제하기보다 시각 의미를 안정적으로 재구성하는 데 초점을 둔다.
