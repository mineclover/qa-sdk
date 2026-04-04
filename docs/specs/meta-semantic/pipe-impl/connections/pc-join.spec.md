---
def:
  id: pc-join
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-connection-catalog
      type: depends_on
    - target: pipe-types
      type: depends_on
---

# ConnectionKind: join — N:1 합류 대기

## 목적 ^purpose

여러 선행 단계가 모두 끝난 뒤 하나의 후속 단계가 시작되는 join 연결 semantics를 정의한다.

## 정의 방식

필드: from(필수, 2+), to(필수)

> 타입: `core/src/types/pipe-spec.ts` `PipeConnection` 참조

## 검증 방식

from[] 일부만 → to 미실행, 전부 → to 실행

## 경로 계산

`countGraphPaths`: 1

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts` `countGraphPaths()`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts` `validatePipeGraph()`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `ConnectionKind` (`"join"`)
- 경로 계산: `packages/core/src/pipe-path.ts` — `countGraphPaths()` switch case
- 전파 규칙: `packages/core/src/pipe-interpret.ts` — `PIPE_PROPAGATION_RULES`
- 검증: `packages/core/src/pipe-validate.ts` — connection 검증
