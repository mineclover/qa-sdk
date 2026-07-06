---
def:
  id: pc-join
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-connection-catalog
      type: traces_to
    - target: pipe-types
      type: traces_to
  sources:
    - packages/core/src/types/pipe-spec.ts
    - packages/core/src/pipe/pipe-path.ts
    - packages/core/src/pipe/pipe-path.test.ts
    - packages/core/src/pipe/pipe-validate.ts
    - packages/core/src/pipe/pipe-validate.test.ts
    - packages/core/src/pipe/pipe-simulate.ts
    - packages/core/src/pipe/pipe-simulate.test.ts
    - packages/core/src/pipe/pipe-interpret.ts
    - packages/core/src/pipe/pipe-interpret.test.ts
    - packages/core/src/pipe/pipe-endpoint.ts
    - packages/core/src/pipe/pipe-endpoint.test.ts

---

# ConnectionKind: join — N:1 합류 대기

## 목적 ^purpose

여러 선행 단계가 모두 끝난 뒤 하나의 후속 단계가 시작되는 join 연결 semantics를 정의한다.

## 정의 방식

필드: from(필수, 2+), to(필수)

> 타입: `packages/core/src/types/pipe-spec.ts` `PipeConnection` 참조

## 검증 방식

from[] 일부만 → to 미실행, 전부 → to 실행

## 경로 계산

`countGraphPaths`: 1

## 관련 소스

- 타입: `packages/core/src/types/pipe-spec.ts`
- 경로: `packages/core/src/pipe/pipe-path.ts` `countGraphPaths()`
- 시뮬: `packages/core/src/pipe/pipe-simulate.ts`
- 검증: `packages/core/src/pipe/pipe-validate.ts` `validatePipeGraph()`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `ConnectionKind` (`"join"`)
- 경로 계산: `packages/core/src/pipe/pipe-path.ts` — `countGraphPaths()` switch case
- 전파 규칙: `packages/core/src/pipe-interpret.ts` — `PIPE_PROPAGATION_RULES`
- 검증: `packages/core/src/pipe/pipe-validate.ts` — connection 검증
