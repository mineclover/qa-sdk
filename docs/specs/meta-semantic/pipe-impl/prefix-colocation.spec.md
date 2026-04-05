---
def:
  id: prefix-colocation
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-catalog
      type: refines
    - target: meta-semantic-data-contract
      type: depends_on
---

# Prefix Colocation

## 목적 ^purpose

prefix가 외부 테이블이나 데이터 계약과 어떤 위치 관계를 가져야 하는지, 그리고 `table_ref` 기반 출처 선언을 어떻게 검증하는지 고정한다.

## 개요 ^overview

- `table_ref`는 인코딩 대상이 아니라 외부 데이터 위치를 가리키는 참조다.
- 이 참조가 생기면 table 쪽 `referencedBy`와 짝이 맞아야 한다.
- colocation 누락은 prefix 선언 위치와 데이터 계약이 어긋난 상태로 본다.

## 관련 소스

- `packages/core/src/catalog/table-ref-validate.ts`
- `packages/core/src/catalog/catalog.types.ts`
