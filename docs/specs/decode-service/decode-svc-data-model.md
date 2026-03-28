---
def:
  id: decode-svc-data-model
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [tier-infra]
  links:
    - target: decode-service-system
      type: refines
---
# Decode Service — 데이터 모델

## 목적 ^purpose

decode-service가 사용하는 데이터 구조를 정의한다. DB 없이 인메모리로 동작하므로 DecoderPool과 DecodeMap 번들이 유일한 데이터 계층이다.

## 구성 ^overview

### DecoderPool

| 필드 | 타입 | 설명 |
|------|------|------|
| entries | Map\<string, CacheEntry\> | 키: `${prefix}:${version}` |
| ttlMs | number | 캐시 TTL (기본 60초, 0=무한) |

### CacheEntry

| 필드 | 타입 | 설명 |
|------|------|------|
| decoder | PrefixDecoder | index-meta의 디코더 인스턴스 |
| loadedAt | number | Date.now() 시점 |

### DecodeMap 번들

registry-service `GET /api/decode-map`에서 fetch하는 JSON:

| 필드 | 설명 |
|------|------|
| prefix | prefix ID |
| version | prefix 버전 |
| dims | 차원별 entry 배열 |
| shape | 차원별 capacity 배열 |
| labels | 차원 이름 배열 |
