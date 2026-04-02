---
def:
  id: pipe-transition-scope
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-flow-catalog
      type: refines
---

# PipeTransitionScope — 제어 흐름 내 선언적 비즈니스 원자 경계

## 목적 ^purpose

PipeSpec 제어 흐름 안에서 비즈니스 트랜잭션의 원자 경계를 1급으로 선언한다.
"이 묶음은 전부 되거나 전부 안 되거나" — 설계 시점 의도 선언이며,
구현 메커니즘(DB tx, saga, 수동 보상)은 소비자가 결정하는 별도 관심사.

## 니즈

- `PipeCompensate`는 보상 로직(forward + compensate)만 표현. "이 구간이 하나의 원자 전이"라는 경계 선언이 없음
- `PipeEmit`은 단발 이벤트 발행. 어떤 전이에 소속되는지 표현 불가
- `PathSegment.transition`은 좌표→이벤트 전이. 이벤트 그룹 경계 없음
- DB 트랜잭션, 서비스 간 saga 모두 설계 시점에 원자 경계를 선언할 수단이 필요

## ^defines

### PipeTransitionScope 인터페이스

```ts
interface PipeTransitionScope {
  kind: "transition-scope";
  /** 전이 식별자 */
  transitionId: string;
  /** 전이 본체 — 이 안의 모든 동작이 원자적으로 성공하거나 실패 */
  body: PipeFlow;
  /** 이 전이에 소속된 이벤트 목록 */
  events: string[];
  /** 실패 시 보상 (선택) */
  compensate?: PipeFlow;
}
```

### 검증 규칙

- `transitionId` 비어있으면 error
- `events` 빈 배열이면 error (이벤트 없는 전이는 무의미)
- `body` 재귀 검증
- `compensate` 있으면 재귀 검증
- PipeGraph 내 동일 `transitionId` 중복 시 warning

### 역할 분류 (classifyPipeRole)

- transition-scope의 body 내용에 따라 역할 결정 (scope 자체는 역할에 영향 없음)
- compensate 포함 시 concern: `resilience` 추가

### 경로 수 (countPipePaths)

- `countPaths(body) + (compensate ? countPaths(compensate) : 0)` — compensate와 동일 패턴

### fold topology

- transactional 분류 (compensate, finally와 같은 그룹)

## ^consumes

- `PipeFlow` 유니온 (pipe-spec.ts)
- `EventTransition` (catalog.types.ts) — PathSegment.transition과 transitionId 공유
- `getChildFlows` (pipe-analyze.ts) — 순회에 추가
