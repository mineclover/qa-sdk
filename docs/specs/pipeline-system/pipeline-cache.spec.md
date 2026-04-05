---
def:
  id: pipeline-cache
  level: module
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [cache, port]
  links:
    - target: pipeline-cache-test
      type: contains
contains:
  - pipeline-cache-test
---
# KeyCache — 쿼리 결과 캐시 포트

## 목적 ^purpose

packed_key를 기반으로 디코딩 결과를 캐시하여 hot path O(1) lookup을 제공한다. TTL 기반 자동 만료와 LRU eviction을 지원하며, 구현체에 따라 L1(in-process), L2(Redis/KV)로 확장 가능한 포트-어댑터 구조이다.

## 정의 ^defines

- `KeyCache<T>` — 캐시 포트 인터페이스 (get/set/delete/clear/has/stats)
- `CacheEntry<T>` — 캐시 항목 메타데이터 (value, cachedAt, ttlMs)
- `CacheStats` — 캐시 통계 (size, hits, misses, evictions)
- `InMemoryKeyCache<T>` — L1 프로세스 내 인메모리 구현체

## 소비 ^consumes

- `packages/core/src/ports/key-cache.port.ts` — 포트 정의
- `packages/store/src/adapters/memory/key-cache.adapter.ts` — InMemory 구현

## 구성 ^overview

### 포트 인터페이스 (KeyCache<T>)

| 메서드 | 시그니처 | 설명 |
|--------|---------|------|
| `get` | `(key: string) => Promise<T \| undefined>` | 캐시 조회. 만료 시 undefined |
| `set` | `(key: string, value: T, ttlMs: number) => Promise<void>` | 값 저장. ttlMs=0이면 영구 |
| `delete` | `(key: string) => Promise<boolean>` | 단건 삭제. 존재하면 true |
| `clear` | `() => Promise<void>` | 전체 삭제 |
| `has` | `(key: string) => Promise<boolean>` | 키 존재 여부 (만료 고려) |
| `stats` | `() => CacheStats` | 동기 통계 반환 |

### InMemoryKeyCache 구현

- **LRU**: Map 삽입 순서 기반. `get()` 시 삭제+재삽입으로 순서 갱신.
- **maxSize**: 기본 10,000. 초과 시 Map 첫 번째 항목(가장 오래된)부터 제거.
- **TTL**: `set()` 시 `cachedAt = Date.now()` 기록. `get()`/`has()` 시 lazy eviction.
  - `ttlMs === 0` → 영구 캐시 (만료 없음)
  - `Date.now() - cachedAt > ttlMs` → 만료 → 삭제 + evictions++
- **stats 초기화**: `clear()` 시 hits/misses/evictions 모두 0으로 리셋.
- **덮어쓰기**: 동일 키 `set()` 시 기존 항목 삭제 후 새로 삽입 (순서 갱신 + size 유지).

### 확장 가능성

- L2 구현체(Redis, Cloudflare KV 등)는 같은 `KeyCache<T>` 포트를 구현.
- 서비스에서 L1 → L2 fallback 체인 구성 가능.
