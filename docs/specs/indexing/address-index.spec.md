---
def:
  id: address-index-spec
  address: def_document:v2:342146
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: indexing-core-system
      type: refines
---
# Address Index

## 목적 ^purpose

`address_context` 문자열(`"tracking:v2:1200"`)을 `{ prefixId, version, address }` 튜플로 정규화하고, prefix×address 범위로 역색인 검색을 지원하는 라이브러리. ingest 시점에 레코드를 인덱싱하고, 단일/다중 prefix 교차 조회와 통계를 제공한다.

## 구성 ^overview

- `AddressIndex` 포트: `index()`, `find()`, `findCross()`, `getAddresses()`, `stats()`, `count()`, `clear()`
- `ParsedAddress`: prefixId + version + address 파싱 결과
- `AddressQuery`: 단일 prefix 정확 매치 또는 범위 + 시간 필터
- `CrossPrefixQuery`: 다중 prefix AND 결합 조회
- `InMemoryAddressIndex`: 개발/테스트용 인메모리 구현
- 소스: `packages/address-index/src/`
