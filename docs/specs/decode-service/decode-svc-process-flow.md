---
def:
  id: decode-svc-process-flow
  address: def_document:v2:137347
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [tier-infra]
  links:
    - target: decode-service-system
      type: refines
    - target: decode-svc-state-model
      type: depends_on
---
# Decode Service — 처리 흐름

## 목적 ^purpose

서비스 시작부터 디코딩 요청 처리, 캐시 만료까지의 흐름을 정의한다.

## 구성 ^overview

### 시작 흐름

```
1. server.ts 진입
2. env.ts에서 PORT, REGISTRY_URL, CACHE_TTL_MS 파싱
3. DecoderPool 생성 (빈 상태)
4. registry-service GET /api/decode-map fetch (AbortSignal.timeout 5초)
   ├── 성공 → DecodeMap[] 순회, pool.loadMap() per entry
   └── 실패 → console.warn, 빈 pool로 시작 (fail-open)
5. createApp({ pool }) → Hono 앱 생성
6. serve({ fetch: app.fetch, port })
```

### 요청 흐름

```
POST /decode { input, prefix?, version? }
  1. Zod 스키마 검증 (decodeSchema)
  2. resolveDecoder(pool, prefix, version, input) → PrefixDecoder
  3. decoder.resolve(input) → VersionedValue
  4. decoder.decode(input) → entities
  5. 응답 조립 + 반환
```

### 캐시 만료 흐름

```
pool.get(key)
  1. entries.get(key) → CacheEntry?
  2. CacheEntry 존재 + (now - loadedAt) > ttlMs → evict, return null
  3. CacheEntry 존재 + TTL 내 → return decoder
  4. CacheEntry 없음 → return null (404)
```

- 만료 후 재로딩 메커니즘 없음 — 서비스 재시작 필요
