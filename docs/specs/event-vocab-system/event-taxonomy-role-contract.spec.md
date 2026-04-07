---
def:
  id: event-taxonomy-role-contract
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: event-catalog
  tags: [structural, observability]
  links:
    - target: event-vocab-system
      type: refines
    - target: event-taxonomy-layering-plan
      type: depends_on
    - target: service-event-adoption-plan
      type: depends_on
---

# Event Taxonomy Role Contract

## 목적 ^purpose

event taxonomy를 구성하는 각 레이어의 책임을 고정한다. 이 문서는 분석 규칙이나 운영 해석이 아니라, 각 레이어가 어떤 입력과 출력을 소유하는지 명확히 하는 계약 문서다.

## 구성 ^overview

- global vocabulary
- mapping pack
- service adoption
- materialization
- check/assert gate

## 역할 계약 ^contract

### 1. Global Vocabulary

소유:
- event 의미
- category
- payload guide
- graph hint

비소유:
- 서비스별 채택
- prefix 해석 규칙
- materialized schema

질문:
- 이 이벤트는 전역적으로 무엇을 의미하는가?

### 2. Mapping Pack

소유:
- event -> prefix 해석 규칙
- pack owner
- pack version/status

비소유:
- 서비스별 채택 여부
- 서비스별 허용 category
- runtime materialization 결과

질문:
- 이 이벤트를 이 pack에서는 어떤 prefix 조합으로 읽는가?

### 3. Service Adoption

소유:
- serviceId별 채택 pack
- pack version pin
- allowed category 범위

비소유:
- event 자체 의미
- prefix mapping 규칙
- prefix ownership 자체

질문:
- 이 서비스는 어떤 pack을 실제로 채택하는가?

### 4. Materialization

소유:
- adoption을 읽어 서비스별 event schema를 생성하는 규칙
- `_core` vocabulary seed
- 서비스별 materialized event records

비소유:
- pack 정의 자체
- adoption 정책 자체
- drift 판정 정책

질문:
- adoption 결과가 실제 registry record로 어떻게 생성되는가?

### 5. Check / Assert Gate

소유:
- 정합성 판정
- drift issue code
- fail/pass surface

비소유:
- event 정의 자체
- pack/adoption 수정
- 분석/원인 추론

질문:
- 현재 구조가 계약에 맞는가?

## 고정 원칙 ^rules

1. vocabulary는 의미를 정의하지만 채택을 결정하지 않는다.
2. pack은 해석 규칙을 정의하지만 서비스를 선택하지 않는다.
3. adoption은 채택을 정의하지만 mapping을 재정의하지 않는다.
4. materialization은 생성만 하고 의미를 바꾸지 않는다.
5. gate는 판정만 하고 정의를 바꾸지 않는다.

## 비목표 ^non-goals

- drift 원인 분석
- 추천/자동 수정
- ownership 정책의 확장 해석
- custom event 확장 설계

이 항목들은 후속 레이어에서 다룬다.
