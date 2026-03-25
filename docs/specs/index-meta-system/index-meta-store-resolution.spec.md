---
def:
  id: index-meta-store-resolution
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: address-spec
      type: depends_on
    - target: index-meta-store
      type: refines
---

# Index Meta Store - 주소 해석과 재사용

## 목적 ^purpose

index-meta 저장소의 인메모리 구현, DB 상태 예시, 주소 해석, 디코딩 없는 주소 재사용 전략을 정리한다.

## 해석 흐름

- 인메모리 구현은 저장 계약을 검증하는 기준점이며, DB 구현은 이를 영속화하는 역할이다.
- 주소 해석은 schema lookup, version resolution, canonical format 변환의 순서로 이뤄진다.
- decode 없는 주소 재사용은 graph/analytics 계층에서 주소를 그대로 key로 쓰는 경우에 중요하다.

## 구현 메모

- 예시 데이터와 DB 상태는 운영자가 어떤 캐시를 두고 어떤 필드를 materialize할지 판단하는 기준이 된다.
- address resolution은 `address-spec`을 전제로 하며, 저장 계약 자체는 `index-meta-store-contract`를 따른다.
- store 계층은 decode engine을 대체하지 않고, decode-ready snapshot을 제공하는 데 집중한다.
