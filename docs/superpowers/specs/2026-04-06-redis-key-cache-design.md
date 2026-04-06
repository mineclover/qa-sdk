# I-4: Redis KeyCache 어댑터 설계

> 2026-04-06. KeyCache\<T\> 포트의 Redis(ioredis) 구현.

## 목적

packed_key → decode 결과 캐싱(ingest 핫패스 O(1))과 범용 서비스 간 공유 캐시 레이어를 Redis로 제공한다.

## 접근법

단독 RedisKeyCache — 기존 `KeyCache<T>` 포트를 ioredis로 구현. L1→L2 체인은 별도 작업.

## RedisKeyCache 클래스

```typescript
class RedisKeyCache<T = unknown> implements KeyCache<T> {
  constructor(redis: Redis, opts?: { prefix?: string })
}
```

### 메서드 매핑

| KeyCache | Redis 명령 | 비고 |
|----------|-----------|------|
| `get(key)` | `GET prefix:key` → JSON.parse | miss → undefined, hit 카운터 증가 |
| `set(key, val, ttlMs)` | `SET prefix:key json PX ttlMs` | ttlMs=0 → SET without expire |
| `delete(key)` | `DEL prefix:key` | DEL 결과 > 0 → true |
| `has(key)` | `EXISTS prefix:key` | 1 → true |
| `clear()` | `SCAN 0 MATCH prefix:*` + `DEL` (배치) | prefix 범위만 삭제 |
| `stats()` | 로컬 카운터 반환 | 프로세스 범위 (InMemory와 동일) |

### prefix

- 기본값: `"kc:"`
- 모든 Redis 키에 prefix 적용 → 네임스페이스 격리
- `clear()`는 prefix 매칭 키만 SCAN+DEL, FLUSHDB 아님

### 직렬화

- `JSON.stringify()` / `JSON.parse()` — 범용 T 타입 지원
- parse 실패 → undefined 반환 + miss 카운터 (데이터 손상 방어)

### stats

```typescript
interface CacheStats {
  size: number;      // Redis DBSIZE 대신 SCAN count (prefix 범위)
  hits: number;      // 로컬 프로세스 카운터
  misses: number;    // 로컬 프로세스 카운터
  evictions: number; // Redis TTL 만료는 추적 불가 → 항상 0
}
```

- `size`는 호출 시 `SCAN` count로 실시간 조회 (비싸므로 캐싱 고려)
- evictions는 Redis가 내부적으로 처리하므로 로컬에서 추적 불가 → 0 고정

## 파일 배치

```
packages/store/
  src/adapters/redis/
    key-cache.adapter.ts        ← RedisKeyCache 구현
    key-cache.adapter.test.ts   ← 테스트
    index.ts                    ← re-export
  src/index.ts                  ← RedisKeyCache export 추가
  package.json                  ← ioredis optionalDependencies
```

## 의존성

- `ioredis` → **optionalDependencies** (Redis 안 쓰는 환경에서 store 패키지 정상 사용)
- 동적 import: `await import("ioredis")` — 미설치 시 명확한 에러 메시지

## 테스트 전략

- ioredis mock (수동 Map 기반 mock) — 실 Redis 서버 불필요
- InMemoryKeyCache 11개 테스트와 동일 시나리오: set/get, TTL, has, delete, clear, stats, missing key

## Store Factory 연결

`CACHE_DRIVER` 환경변수로 캐시 드라이버 선택:

```typescript
type CacheDriver = "memory" | "redis";
```

- `memory` (기본): InMemoryKeyCache
- `redis`: `REDIS_URL` 필수 → `new Redis(url)` → `new RedisKeyCache(redis)`
