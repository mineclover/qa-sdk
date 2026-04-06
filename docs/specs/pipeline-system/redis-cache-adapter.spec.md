---
def:
  id: redis-cache-adapter
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: store
  tags: [cache, redis, l2]
  links:
    - target: pipeline-cache
      type: refines
---

# Redis Cache Adapter

## 목적 ^purpose

KeyCache\<T\> 포트의 Redis(ioredis) 구현. packed_key decode 결과를 서비스 간 공유하고, 프로세스 재시작 시에도 캐시를 유지하는 L2 네트워크 캐시를 제공한��.

## 구성 ^overview

- **RedisKeyCache\<T\>** — ioredis 기반 KeyCache\<T\> 구현. prefix 네임스페이스 격리.
- **decode-service 통합** — DecoderPool L1 miss → Redis L2 조회. fail-open.
- **CLI cache 명령** — `cache stats`, `cache clear` Redis 캐시 관리.

## 소비처 ^consumes

| # | 소비처 | 패턴 |
|---|--------|------|
| UC-1 | decode-service | L1 pool miss → Redis GET → decode → Redis SET |
| UC-2 | CLI cache stats | Redis SCAN + INFO 명령으로 통계 조회 |
| UC-3 | CLI cache clear | SCAN + DEL로 prefix 범위 캐시 삭제 |
| UC-4 | 범용 서비스 캐시 | 어떤 서비스든 KeyCache\<T\> 주입 |

## RedisKeyCache 매핑 ^method

| KeyCache | Redis 명령 | 비고 |
|----------|-----------|------|
| `get(key)` | `GET prefix:key` → JSON.parse | miss → undefined |
| `set(key, val, ttlMs)` | `SET prefix:key json PX ttlMs` | ttlMs=0 → 영구 |
| `delete(key)` | `DEL prefix:key` | count > 0 → true |
| `has(key)` | `EXISTS prefix:key` | 1 → true |
| `clear()` | `SCAN MATCH prefix:*` + `DEL` | prefix 범위만 |
| `stats()` | 로컬 카운터 | hits/misses 프로세스 범위, evictions=0 |
| `scanSize()` | `SCAN MATCH prefix:*` count | 확장 메서드 |

- **prefix**: 기본 `"kc:"`. 네임스페이스 격리.
- **직렬화**: JSON.stringify/parse. parse 실패 → undefined + miss.
- **stats.size**: 0 (SCAN 비용 회피). `scanSize()`로 명시적 조회.

## decode-service 통합 ^delegates

```
POST /decode 요청
  → Redis GET "decode:{prefix}:{version}:{input}"
    → hit → 즉시 반환
    → miss → DecoderPool decode → 결과를 Redis SET (TTL = CACHE_TTL_MS)
```

fail-open: Redis 장애 시 in-memory pool만으로 동작.

## 환경변수

| 변수 | 사용처 | 기본값 |
|------|--------|--------|
| `CACHE_DRIVER` | decode-service | `"memory"` |
| `REDIS_URL` | decode-service, CLI | (없으면 memory fallback) |
| `CACHE_TTL_MS` | decode-service | `60000` |

## CLI 명령

| 명령 | 동작 |
|------|------|
| `qa-sdk cache stats [--prefix]` | Redis SCAN count + INFO memory |
| `qa-sdk cache clear [--prefix] [--all]` | SCAN + DEL. --all 시 decode:/kc:/reg: 전부 |

## 파일 배치

| 파일 | 역할 |
|------|------|
| `store/src/adapters/redis/key-cache.adapter.ts` | RedisKeyCache 구현 |
| `store/src/adapters/redis/key-cache.adapter.test.ts` | 12 테스트 (mock) |
| `decode-service/src/config/env.ts` | CACHE_DRIVER, REDIS_URL 환경변수 |
| `decode-service/src/routes/decode.ts` | L2 캐시 통합 |
| `cli/src/command-groups/cache.commands.ts` | CLI cache 명령 |

## 테스트

| 대상 | 케이스 |
|------|:---:|
| RedisKeyCache (mock) | 12 |

## 후속 작업

- Phase 3: 서비스 간 캐시 공유 (ingest, gate)
- Phase 4-3: `cache warm` CLI 명령
- Phase 5: catalog 변경 시 자동 무효화

전체 로드맵: `docs/specs/pipeline-system/redis-cache-pipeline.todo.md`
