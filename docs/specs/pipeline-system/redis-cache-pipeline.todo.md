---
def:
  id: redis-cache-pipeline-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [cache, redis, pipeline]
  links:
    - target: ingest-infra-system
      type: depends_on
---

# Redis 캐시 파이프라인 — TODO

## 목적 ^purpose

Redis 기반 L2 캐시 레이어를 구축하고, decode 결과 공유·콜드 스타트 방지·캐시 무효화를 서비스/SDK/CLI 전체에 걸쳐 제공한다.

---

## Phase 1: RedisKeyCache 어댑터 (building block)

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|------|---------|--------|------|
| 1-1 | RedisKeyCache\<T\> 구현 | 높 | 중 | ioredis 기반 KeyCache\<T\> 포트 구현. GET/SET/DEL/EXISTS/SCAN. prefix 네임스페이스 |
| 1-2 | ioredis optionalDependencies | 높 | 낮 | store 패키지에 ioredis optional 추가. 미설치 시 명확한 에러 |
| 1-3 | RedisKeyCache 테스트 | 높 | 중 | ioredis mock 기반. InMemoryKeyCache 11개와 동일 시나리오 |
| 1-4 | store/index.ts export | 높 | 낮 | RedisKeyCache re-export |

## Phase 2: decode-service 캐시 통합

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|------|---------|--------|------|
| 2-1 | DecoderPool Redis fallback | 높 | 중 | pool miss → Redis 조회 → hit 시 pool에 채움. CACHE_DRIVER=redis 환경변수 |
| 2-2 | decode 결과 Redis 저장 | 높 | 중 | decode 성공 시 결과를 Redis에 SET (TTL = CACHE_TTL_MS) |
| 2-3 | decode-service env 확장 | 중 | 낮 | CACHE_DRIVER, REDIS_URL을 config/env.ts에 추가 |
| 2-4 | decode-service health에 Redis 상태 포함 | 낮 | 낮 | /health 응답에 redis connected/disconnected 표시 |

## Phase 3: 서비스 간 캐시 공유

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|------|---------|--------|------|
| 3-1 | ingest-server decode 캐시 조회 | 중 | 중 | phase-2 decode 시 Redis 캐시 우선 조회. miss → decode-service HTTP 호출 |
| 3-2 | gate-service 캐시 통합 | 중 | 중 | prefix 검증 시 decode 캐시 활용 |
| 3-3 | ServiceProfile에 REDIS_URL 추가 | 중 | 낮 | service-profile.json에 redis 연결 정보 포함 |

## Phase 4: CLI 캐시 유틸리티

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|------|---------|--------|------|
| 4-1 | `cache stats` 명령 | 중 | 낮 | Redis 캐시 통계 조회 (키 수, 메모리, hit rate) |
| 4-2 | `cache clear` 명령 | 중 | 낮 | 전체 또는 prefix 지정 캐시 삭제 |
| 4-3 | `cache warm` 명령 | 낮 | 중 | catalog 기반 decode 결과 사전 워밍 |

## Phase 5: 캐시 무효화

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|------|---------|--------|------|
| 5-1 | catalog 변경 감지 → 캐시 flush | 중 | 중 | registry generation 변경 시 관련 prefix 캐시 무효화 |
| 5-2 | version 업그레이드 무효화 | 중 | 중 | prefix version 변경 시 이전 version 캐시 삭제 |
| 5-3 | Redis Pub/Sub 무효화 전파 | 낮 | 높 | 멀티 인스턴스 간 무효화 이벤트 전파 |

---

## 이번 작업 범위

**Phase 1 전체 + Phase 2 (2-1, 2-2, 2-3) + Phase 4 (4-1, 4-2)** 를 I-4로 진행.

Phase 3, Phase 5, Phase 4 (4-3)은 후속 작업.

## 비고

- ioredis는 optionalDependencies — Redis 없는 환경에서 store 패키지 정상 동작
- 모든 Redis 연동은 fail-open — Redis 장애가 서비스를 차단하지 않음
- DecoderPool의 기존 in-memory TTL-LRU 캐시는 L1으로 유지, Redis는 L2
