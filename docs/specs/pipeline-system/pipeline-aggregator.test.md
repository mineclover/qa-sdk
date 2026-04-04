---
def:
  id: pipeline-aggregator-test
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: implemented
  layer: operation
  tags: [testing, aggregation]
  links:
    - target: pipeline-aggregator
      type: depends_on
---

# Aggregator 테스트 명세

## 목적 ^purpose

InMemoryAggregator의 groupByKey, projectAxis, 시간 필터, limit, decode 실패 처리를 검증한다. 총 9개 테스트.

소스: `packages/store/src/adapters/memory/aggregator.adapter.test.ts`

## 전제 ^preconditions

- InMemoryAggregator 인스턴스 (decode: colon-separated key → {env, region, svc} 변환)
- 테스트 데이터 5건:
  - prod:us:api (3건, 2026-04-01 ~ 2026-04-02)
  - prod:eu:api (1건)
  - dev:us:web (1건)

## 스텝 ^steps

### groupByKey (4)

1. 지정 키 기반 그룹핑 — prod:us:api(count=3, lastSeen=04-02), prod:eu:api(count=1). count 내림차순
2. limit 적용 — 3개 키 중 limit=2 → 상위 2건만 반환
3. 시간 범위 필터 — from/to 지정 시 범위 내 항목만 count
4. 매칭 키 없음 → 빈 배열

### projectAxis (5)

5. 단일 축 프로젝션 — ["env"] → prod(4건), dev(1건)
6. 복수 축 프로젝션 — ["env", "region"] → prod:us(3), prod:eu(1), dev:us(1)
7. decode 함수 없이 호출 → 에러 ("decode 함수가 필요합니다")
8. decode 실패(undefined 반환) → 해당 항목 건너뜀, 유효 항목만 집계
9. limit 적용 — 3개 조합 중 limit=1 → 상위 1건만 반환

## 검증 ^assertions

- groupByKey: count 내림차순 정렬, lastSeen 최신 타임스탬프 반영
- 시간 필터: from/to 범위 경계가 포함/제외 올바르게 동작
- projectAxis: 지정 축만 추출, 미지정 축 제거
- decode 실패: 에러 전파 없이 해당 항목만 스킵
- limit: 정렬 후 상위 N건 절단
