---
def:
  id: pipeline-cache-test
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [testing, cache]
  links:
    - target: pipeline-cache
      type: depends_on
---

# KeyCache 테스트 명세

## 목적 ^purpose

InMemoryKeyCache의 기본 동작, TTL 만료, LRU eviction, 통계 추적, 덮어쓰기를 검증한다. 총 11개 테스트.

소스: `packages/store/src/adapters/memory/key-cache.adapter.test.ts`

## 전제 ^preconditions

- `InMemoryKeyCache<string>` 인스턴스 (기본 maxSize=10,000)
- `vi.useFakeTimers()` 로 시간 제어
- maxSize=3인 소형 캐시 (LRU 테스트용)

## 스텝 ^steps

### 기본 동작 (3)

1. set/get 기본 동작 — set("k1", "v1", 60000) → get("k1") === "v1"
2. 존재하지 않는 키 → undefined
3. delete — 존재하는 키 삭제 시 true, 이미 없으면 false

### TTL 만료 (2)

4. TTL 만료 시 undefined 반환 + evictions 카운트 증가
5. TTL 0 → 영구 캐시 (999,999ms 경과 후에도 유지)

### has (1)

6. has — 존재 시 true, 만료 후 false + misses 카운트 증가

### clear (1)

7. clear — 전체 삭제 + 통계(hits/misses) 초기화

### stats (1)

8. stats — hit(2회), miss(1회) 정확한 카운트. size=1

### LRU eviction (2)

9. maxSize 초과 시 가장 오래된 항목 제거 — a/b/c 저장 후 d 삽입 → a 제거됨
10. get으로 LRU 순서 갱신 — a get 후 d 삽입 → b 제거됨 (a는 최신화)

### 덮어쓰기 (1)

11. 동일 키 set → 값 교체, size 유지 (중복 없음)

## 검증 ^assertions

- TTL: 만료 시점 정확 (100ms 설정 → 101ms에서 만료). get()/has() 모두 misses 카운트
- LRU: Map 삽입 순서 기반으로 가장 오래된 항목이 먼저 제거
- LRU 갱신: get() 호출이 항목을 최신으로 이동
- stats: hit/miss/eviction 카운트가 각 동작에 정확히 반영
- clear: 통계까지 초기화
