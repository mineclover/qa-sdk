---
def:
  id: path-matcher-migration
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: completed
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: meta-semantic-execution-semantics
      type: depends_on
sources:
  - packages/engine/src/matching/path-matcher-adapter.ts
  - packages/engine/src/matching/path-matcher-adapter.test.ts
---

# graph-matcher → PathMatcher 전환 (완료)

## 목적 ^purpose

기존 `graph-matcher`(ScenarioSpec 기반 greedy 매칭)를
`PathMatcher`(PipeGraph 기반 경로 모델 매칭)로 전환한다.
~~어댑터 패턴으로 인터페이스를 보존하여 점진 전환.~~
**2026-04-03 전환 완료** — graph-matcher 삭제, PathMatcher 단일 엔진 확정.

## 정의 ^defines

- `matchViaPathMatcher(spec, runtime)` — 유일한 매칭 엔진
  - SpecGraph + RuntimeGraph → PipeGraph + RunResult 변환
  - `matchPath` 호출 후 MatchResult로 역변환

## 소비 ^consumes

- `matchPath` (`@qa-sdk/core`) — PathMatcher 핵심 함수
- `evaluateConstraints` (engine/matching) — constraint 평가 재사용

## 변환 알고리즘

**SpecGraph → PipeGraph:**
- `step_id` → `pipeId`
- `event_key` → `trigger.eventKey`
- edges 없으면 순차 연결 자동 생성 (PathMatcher BFS reachability 확보)

**RuntimeGraph → RunResult:**
- event_key + version + source + record_kind 필터 후 spec step에 할당
- constraint 통과 → `status: "ok"` ExecutedStep
- constraint 실패 → `status: "error"` ExecutedStep (PathMatcher가 fail 판정)
- 미매칭 → RunResult에 미포함 (PathMatcher가 missingPipes로 탐지)

**PathMatcher → MatchResult 역변환:**
- `matchedPipes` → `step_matches[].verdict = "pass"`
- `errorSteps` → `step_matches[].verdict = "fail"` + constraint_results 복원
- `missingPipes` → `step_matches[].verdict = "fail"|"warn"` + `missing_steps`
- ordering violations: spec.edges 기반 timestamp 검사 (별도 수행)

## 관련 소스

- `packages/engine/src/matching/path-matcher-adapter.ts` — 매칭 엔진 구현
- `packages/engine/src/matching/path-matcher-adapter.test.ts` — 22 tests

## 완료 이력

- 2026-04-03: graph-matcher.ts 삭제, USE_PATH_MATCHER flag 제거, matchViaPathMatcher 단일 경로 확정 (0e50855)
