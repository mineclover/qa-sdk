---
def:
  id: address-index
  address: def_document:v2:342016
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  svc: address-index
  tags: [domain, coordinate, indexing]
  links:
    - target: index-meta-system
      type: refines
---
# address-index

## 목적 ^purpose

좌표 주소 기반 역색인 라이브러리. `address_context`를 정규화하여 prefix×address 범위 검색을 지원한다.

## 구성 ^overview

- **ParsedAddress**: 주소 문자열을 prefix + version + position으로 분해
- **AddressIndex** (port): 역색인 추상 인터페이스 — index / query / cross-prefix query / stats
- **InMemoryAddressIndex**: 메모리 기반 구현체. 테스트·CLI·로컬 탐색용
- **AddressQuery**: 단일 prefix 범위 검색 (position range, exact match)
- **CrossPrefixQuery**: 여러 prefix를 동시에 검색하여 교차 참조

## 설계 결정 ^intent

- Port/Adapter 패턴 — InMemory 외 SQLite·Redis 어댑터 확장 가능
- address_context 정규화는 parseAddressContext()에서 일관되게 수행
- 좌표계의 역방향 질의("이 주소를 사용하는 prefix는?")를 가능하게 함
