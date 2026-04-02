---
def:
  id: pipe-types
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: ms-concept-pipe
      type: implements
---

# PipeFlow 타입 정의

## 목적 ^purpose

PipeFlow 29종 흐름 제어 타입, PipeSpec(단일 노드), PipeGraph(노드 연결),
ConnectionKind 8종, Constraint 타입을 정의한다.

## 관련 소스

- `packages/core/src/types/pipe-spec.ts` — 전체 타입 정의

## 구성 ^overview

PipeFlow 29종 (6카테고리):
- 기본(2): step, sequence
- 분기(2): branch, optional
- 동시성(3): parallel, race, await
- 내결함(2): retry, fallback
- 반복(1): loop
- 트랜잭션(1): compensate
- 비동기(1): emit
- 정리(1): finally
- 시간(1): timeout
- 제어(1): feedback
- 배치(4): map, reduce, buffer, filter
- 안정화(3): circuit-breaker, throttle, debounce
- 데이터변환(2): split, enrich
- 관측(1): tap
- 스트리밍(2): resequence, window
- 상태(2): dedup, correlation

ConnectionKind 8종: next, conditional, event, error, compensate, fan-out, join, feedback

PipeConnection: N:M 지원 (from/to: string | string[])

## 검증

타입 체크: `pnpm --filter @qa-sdk/core build`
