---
def:
  id: path-matcher-migration
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: meta-semantic-execution-semantics
      type: depends_on
sources:
  - packages/engine/src/matching/path-matcher-adapter.ts
  - packages/engine/src/matching/path-matcher-adapter.test.ts
  - packages/engine/src/orchestration/compute-pending-verdicts.ts
---

# graph-matcher → PathMatcher 전환

## 목적 ^purpose

기존 `graph-matcher`(ScenarioSpec 기반 greedy 매칭)를
`PathMatcher`(PipeGraph 기반 경로 모델 매칭)로 전환한다.
어댑터 패턴으로 인터페이스를 보존하여 점진 전환.

## 정의 ^defines

- `matchViaPathMatcher(spec, runtime)` — graph-matcher 호환 어댑터
  - SpecGraph + RuntimeGraph → PipeGraph + RunResult 변환
  - `matchPath` 호출 후 MatchResult(graph-matcher 형식)로 역변환
- `USE_PATH_MATCHER` env var — feature flag (기본: `false`)

## 소비 ^consumes

- `matchPath` (`@qa-sdk/core`) — PathMatcher 핵심 함수
- `evaluateConstraints` (engine/matching) — constraint 평가 재사용
- `matchGraphs` (engine/matching) — 기존 경로 (flag=false 시 사용)

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

**PathMatcher MatchResult → graph-matcher MatchResult:**
- `matchedPipes` → `step_matches[].verdict = "pass"`
- `errorSteps` → `step_matches[].verdict = "fail"` + constraint_results 복원
- `missingPipes` → `step_matches[].verdict = "fail"|"warn"` + `missing_steps`
- ordering violations: spec.edges 기반 timestamp 검사 (별도 수행)

## 관련 소스

- `packages/engine/src/matching/path-matcher-adapter.ts` — 어댑터 구현
- `packages/engine/src/matching/path-matcher-adapter.test.ts` — 18 tests
- `packages/engine/src/orchestration/compute-pending-verdicts.ts` — feature flag 적용

## 잔여 작업

- `USE_PATH_MATCHER` 기본값을 `true`로 전환 (충분한 검증 후)
- graph-matcher 코드 + 관련 테스트 제거
