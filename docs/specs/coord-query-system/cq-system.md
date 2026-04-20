---
def:
  id: cq-system
  tier: system
  address: def_document:v2:68618
  scope: feature
  aspect: encoding_func
  depth: overview
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [structural, entry-point]
  links:
    - target: cq-policy-resolver
      type: contains
    - target: cq-cross-index
      type: contains
    - target: cq-version-query
      type: contains
    - target: cq-relational-engine
      type: contains
    - target: wi-system
      type: depends_on
---

# Coordinate Query 시스템

## 목적 ^purpose

닫힌 좌표 공간 위의 패턴 포함 관계, 정책 해소, cross-index 합성 질의, 버전 횡단 탐색을 다루는 n차원 연산 계층. range algebra 위에 lattice, policy, join, version 연산을 쌓는다.

## 구성 ^overview

- `cq-policy-resolver`: PolicyRule 집합에서 특정 좌표에 적용되는 정책을 해소하는 함수.
- `cq-cross-index`: 서로 다른 prefix 간 공유 축을 기반으로 합성 질의를 수행하는 함수.
- `cq-version-query`: 동일 prefix의 여러 버전을 횡단하여 주소 변환, 히스토리 조회, 마이그레이션 경로 탐색을 수행하는 함수.
- `cq-relational-engine`: policy-resolver, cross-index-query, version-query를 통합하여 단일 질의 인터페이스를 제공하는 오케스트레이터.
