# I-4: Redis 캐시 파이프라인 설계

> 2026-04-06. Redis 기반 L2 캐시 — 어댑터 + decode-service 통합 + CLI 유틸.

## 목적

packed_key decode 결과를 Redis에 영속 캐싱하여 서비스 간 공유, 콜드 스타트 방지, 캐시 관리 CLI를 제공한다.

## 유저 시나리오

| # | 시나리오 | 현재 | Redis 도입 후 |
|---|---------|------|-------------|
| US-1 | 같은 packed_key 반복 decode | 각 서비스가 독립 decode | Redis hit → decode 스킵 |
| US-2 | 서비스 재배포 | 캐시 0에서 시작 | Redis에 이전 캐시 잔존, hit rate 유지 |
| US-3 | catalog 변경 후 캐시 관리 | 수동 서비스 재시작 | CLI `cache clear` → 즉시 무효화 |
| US-4 | 캐시 상태 모니터링 | 없음 | CLI `cache stats` → 키 수, hit rate 확인 |

## 이번 작업 범위

**Phase 1** (어댑터) + **Phase 2** (decode-service 통합) + **Phase 4 일부** (CLI stats/clear)

후속: 서비스 간 공유 (Phase 3), 무효화 자동화 (Phase 5), CLI warm (Phase 4-3)

전체 로드맵: `docs/specs/pipeline-system/redis-cache-pipeline.todo.md`

---

## Phase 1: RedisKeyCache 어댑터

### 클래스

```typescript
class RedisKeyCache<T = unknown> implements KeyCache<T> {
  constructor(redis: Redis, opts?: { prefix?: string })
}
```

### 메서드 매핑

| KeyCache | Redis 명령 | 비고 |
|----------|-----------|------|
| `get(key)` | `GET prefix:key` → JSON.parse | miss → undefined, hit 카운터 |
| `set(key, val, ttlMs)` | `SET prefix:key json PX ttlMs` | ttlMs=0 → SET without expire |
| `delete(key)` | `DEL prefix:key` | DEL > 0 → true |
| `has(key)` | `EXISTS prefix:key` | 1 → true |
| `clear()` | `SCAN MATCH prefix:*` + `DEL` 배치 | prefix 범위만 |
| `stats()` | 로컬 카운터 | hits/misses 프로세스 범위, evictions=0 |

### prefix

- 기본값: `"kc:"`
- 네임스페이스 격리. `clear()`는 prefix 매칭만 삭제.

### 직렬화

- `JSON.stringify()` / `JSON.parse()`
- parse 실패 → undefined + miss 카운터 (데이터 손상 방어)

### 파일 배치

```
packages/store/
  src/adapters/redis/
    key-cache.adapter.ts
    key-cache.adapter.test.ts
    index.ts
  package.json  ← ioredis optionalDependencies
```

### 테스트

ioredis mock (수동 Map 기반). InMemoryKeyCache 11개와 동일 시나리오.

---

## Phase 2: decode-service 통합

### 구조

```
decode 요청
  → DecoderPool L1 (in-memory, 기존)
    → miss → RedisKeyCache L2
      → miss → registry에서 DecodeMap 로드 → decode → L1+L2에 저장
```

### 변경 파일

| 파일 | 변경 |
|------|------|
| `decode-service/src/config/env.ts` | `CACHE_DRIVER`, `REDIS_URL` 추가 |
| `decode-service/src/lib/decoder-pool.ts` | Redis fallback 로직. pool miss → Redis GET → hit 시 pool에 채움 |
| `decode-service/src/routes/decode.ts` | decode 성공 시 Redis SET (TTL = CACHE_TTL_MS) |
| `decode-service/src/server.ts` | CACHE_DRIVER=redis 시 Redis 연결 초기화 |

### decode 결과 캐시 키

```
kc:decode:{prefix}:{version}:{address}
```

값: JSON 직렬화된 DecodeResult.

### fail-open

Redis 장애 시 in-memory pool만으로 동작. Redis 연결 에러 → warn 로그 + L1만 사용.

---

## Phase 4 (일부): CLI 캐시 유틸

### 명령

| 명령 | 동작 |
|------|------|
| `qa-sdk cache stats` | Redis INFO + SCAN count → 키 수, 메모리, 프로세스 hit rate |
| `qa-sdk cache clear [--prefix <id>]` | SCAN+DEL. --prefix 지정 시 해당 prefix만 |

### 파일 배치

```
packages/cli/src/command-groups/
  cache.commands.ts  ← 명령 디스크립터 + 핸들러
```

### 연결

ServiceProfile의 `REDIS_URL` 또는 `--redis-url` flag로 Redis 연결.

---

## 환경변수

| 변수 | 사용처 | 기본값 |
|------|--------|--------|
| `CACHE_DRIVER` | decode-service | `"memory"` |
| `REDIS_URL` | decode-service, CLI | (없으면 memory fallback) |
| `CACHE_TTL_MS` | decode-service | `60000` (기존) |
