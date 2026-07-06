---
def:
  tier: component
  id: decode-svc-data-model
  address: def_document:v2:342159
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [data, structural, runtime]
  links:
    - target: decode-service-system
      type: refines
sources:
  - packages/decode-service/src/lib/decoder-pool.ts
  - packages/decode-service/src/lib/decode-cache.ts
  - packages/decode-service/src/routes/health.ts
  - packages/decode-service/src/worker.ts
  - packages/decode-service/src/app.test.ts
  - packages/decode-service/src/lib/decode-cache.test.ts
---
# Decode Service — 데이터 모델

## 목적 ^purpose

decode-service가 사용하는 데이터 구조를 정의한다. DB 없이 인메모리로 동작하므로 DecoderPool과 DecodeMap 번들이 유일한 데이터 계층이다.

## 구성 ^overview

### DecoderPool

| 필드 | 타입 | 설명 |
|------|------|------|
| `_cache` | Map\<string, CacheEntry\> | 키: `${prefix}:${version}` |
| `_ttlMs` | number | 캐시 TTL (기본 60초, 0=무한) |

### CacheEntry

| 필드 | 타입 | 설명 |
|------|------|------|
| decoder | PrefixDecoder \| PrefixDecoderBig | index-meta-workers의 디코더 인스턴스 |
| loadedAt | number | Date.now() 시점 |

### DecodeMap 번들

registry-service `GET /api/decode-map`에서 fetch하는 JSON:

| 필드 | 설명 |
|------|------|
| indexId | prefix ID |
| versionId | prefix 버전 |
| dims | 차원별 DecodeMap dim 배열 |
| shape | 차원별 capacity 배열 |
| size | 전체 주소 공간 크기 |
| numberType | number/bigint decoder 라우팅 힌트 |

### L2 decode cache

| 필드 | 설명 |
|------|------|
| KeyCache | Redis 기반 선택적 캐시 포트 |
| cacheHealth | `/health`에 노출되는 memory/redis 상태 |
