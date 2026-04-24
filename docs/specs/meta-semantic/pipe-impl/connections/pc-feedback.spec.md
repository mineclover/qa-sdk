---
def:
  id: pc-feedback
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
---

# ConnectionKind: feedback — 폐루프 재트리거

## 목적 ^purpose

한 단계의 출력이 다시 입력으로 되먹임되는 폐루프 feedback 연결 semantics를 정의한다.

## 정의 방식

필드: from(필수), to(필수)

> 타입: `core/src/types/pipe-spec.ts` `PipeConnection` 참조

## 검증 방식

수렴 조건 도달 시 종료 확인

## 경로 계산

`countGraphPaths`: countPaths(to)

## 관련 소스

- 타입: `core/src/types/pipe-spec.ts`
- 경로: `core/src/pipe-path.ts` `countGraphPaths()`
- 시뮬: `core/src/pipe-simulate.ts`
- 검증: `core/src/pipe-validate.ts` `validatePipeGraph()`

## 구현 소스

- 타입: `packages/core/src/types/pipe-spec.ts` — `ConnectionKind` (`"feedback"`)
- 경로 계산: `packages/core/src/pipe-path.ts` — `countGraphPaths()` switch case
- 전파 규칙: `packages/core/src/pipe-interpret.ts` — `PIPE_PROPAGATION_RULES`
- 검증: `packages/core/src/pipe-validate.ts` — connection 검증
