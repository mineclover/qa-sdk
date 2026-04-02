---
def:
  id: path-matcher-migration
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: meta-semantic-execution-semantics
      type: depends_on
---

# graph-matcher → PathMatcher 전환

## 목적 ^purpose

기존 `graph-matcher`(ScenarioSpec 기반 greedy 매칭)를
`PathMatcher`(PipeGraph 기반 경로 모델 매칭)로 전환한다.
feature flag로 점진 전환하여 기존 동작 보존을 확인한 후 graph-matcher를 제거한다.

## 할 일

- [ ] graph-matcher의 모든 테스트 케이스를 PathMatcher용으로 변환
- [ ] PathMatcher가 graph-matcher의 모든 케이스 통과 확인
- [ ] feature flag 도입: `USE_PATH_MATCHER=true` (기본: false)
- [ ] 서비스 코드에서 flag에 따라 매처 선택하는 어댑터 작성
- [ ] graph-matcher 테스트 전수 → PathMatcher 통과 확인
- [ ] flag 기본값을 true로 전환
- [ ] graph-matcher 코드 + compat 제거

## 현재 상태

- `PathMatcher`: `core/src/path-matcher.ts` (8 tests, 구현 완료)
- `graph-matcher`: 기존 ScenarioSpec 기반 매칭 (ingest-server 내)
- 차이점: 전곱 그래프 매칭 → 경로 모델 매칭 (합산)

## 위험

- graph-matcher에만 있는 엣지 케이스가 PathMatcher에서 누락될 수 있음
- 전환 기간 동안 두 매처 동시 유지 비용
