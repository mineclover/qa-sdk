---
def:
  id: pipe-transition-scope
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [cross-scope]
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-flow-catalog
      type: refines
    - target: prefix-path-summation
      type: depends_on
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
  /** 전이 식별자 — 3층 공유 키 */
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
- compensate 포함 시 `collectFailureKinds`에도 포함 (`findBottlenecks`와 일관)

### 경로 수 (countPipePaths)

- `countPaths(body) + (compensate ? countPaths(compensate) : 0)` — compensate와 동일 패턴

### fold topology

- transactional 분류 (compensate, finally와 같은 그룹)

## 3층 정합성 ^method

`transitionId`를 공유 키로 세 레이어를 연결한다.

```
┌──────────────────────────────────────────────────────┐
│  좌표 레벨 (PathSegment.transition)                   │
│                                                       │
│  PathSegment {                                        │
│    segmentId: "payment",                              │
│    transition: { eventKey: "transfer.execute" }  ──┐  │
│  }                                                 │  │
├─────────────────────────── transitionId 공유 ──────┤  │
│  제어 흐름 레벨 (PipeTransitionScope)              │  │
│                                                    │  │
│  PipeTransitionScope {                             │  │
│    transitionId: "transfer.execute",          ←────┘  │
│    events: ["account.debit", "account.credit"] ──┐    │
│  }                                               │    │
├─────────────────────────── events 공유 ──────────┤    │
│  이벤트 카탈로그 레벨 (TransitionDef)             │    │
│                                                   │    │
│  TransitionDef {                                  │    │
│    transitionId: "transfer.execute",              │    │
│    events: ["account.debit", "account.credit"] ←──┘   │
│  }                                                    │
└──────────────────────────────────────────────────────┘
```

### 공유 키 규칙

| 연결 | 공유 키 | 의미 |
|------|---------|------|
| 좌표 → 제어 흐름 | `PathSegment.transition.eventKey` = `PipeTransitionScope.transitionId` | 주소 디코딩 시 어떤 비즈니스 전이에 해당하는지 |
| 제어 흐름 → 이벤트 | `PipeTransitionScope.events` = `TransitionDef.events` | 원자 경계 안에 어떤 이벤트들이 소속되는지 |
| 좌표 → 이벤트 | 좌표 → 제어 흐름 → 이벤트 (간접) | 주소에서 이벤트 그룹까지 2-hop 도달 |

### 검증 함수

| 함수 | 위치 | 검증 대상 |
|------|------|----------|
| `validateTransitionBridge(segments, graph)` | `catalog/transition-bridge.ts` | 좌표 ↔ 제어 흐름 양방향 |
| `validateTransitionEvents(transitionId, events)` | `event-catalog/transition.ts` | 제어 흐름 ↔ 이벤트 카탈로그 양방향 |

**전체 3층 검증 체인:**

```ts
// 1. 좌표 ↔ 제어 흐름
const bridgeIssues = validateTransitionBridge(segments, graph);

// 2. 제어 흐름 ↔ 이벤트 카탈로그 (transition-scope마다)
for (const pipe of graph.pipes) {
  walkTransitionScopes(pipe.flow, (scope) => {
    const eventIssues = validateTransitionEvents(scope.transitionId, scope.events);
  });
}
```

### 수집 함수

| 함수 | 레이어 | 수집 대상 |
|------|--------|----------|
| `collectCoordinateTransitions(segments)` | 좌표 | PathSegment 트리의 transition eventKey (중복 제거) |
| `collectControlFlowTransitions(graph)` | 제어 흐름 | PipeGraph 내 모든 transition-scope의 transitionId (중복 제거) |
| `summarizeTransitions(segments, graph)` | 양쪽 | coordinate + controlFlow 요약 |

### 불일치 시나리오

| 상황 | 의미 | severity |
|------|------|----------|
| 좌표에 있고 제어 흐름에 없음 | 주소 공간에 전이가 선언됐지만 실행 로직 없음 | warning |
| 제어 흐름에 있고 좌표에 없음 | 비즈니스 전이가 있지만 주소 체계와 무관 | warning (의도적일 수 있음) |
| 제어 흐름에 있고 이벤트에 없음 | 전이 선언이 event-catalog에 미등록 | warning |
| 이벤트에 있고 제어 흐름에 없음 | TransitionDef가 등록됐지만 실행 로직 없음 | warning |

## ^consumes

- `PipeFlow` 유니온 (pipe-spec.ts) — 30번째 flow kind
- `PathSegment`, `EventTransition` (catalog.types.ts) — 좌표 레벨 전이
- `getChildFlows` (pipe-analyze.ts) — flow 트리 순회
- `TransitionDef` (event-catalog/types.ts) — 이벤트 카탈로그 레벨 전이

## 구현 현황

| 항목 | 파일 | 상태 |
|------|------|------|
| 타입 | `core/types/pipe-spec.ts` | ✅ PipeFlow 유니온 30종 |
| 검증 | `core/pipe/pipe-validate.ts` | ✅ transitionId, events, body, compensate |
| 관심사 | `core/pipe/pipe-interpret.ts` | ✅ compensate 시 resilience |
| 경로 수 | `core/pipe/pipe-path.ts` | ✅ body + compensate |
| 순회 | `core/pipe/pipe-analyze.ts` | ✅ getChildFlows, collectFailureKinds |
| 시뮬레이션 | `core/pipe/pipe-simulate.ts` | ✅ body 실행 |
| 런타임 | `core/pipe/pipe-runtime.ts` | ✅ body 실패 시 compensate |
| 직렬화 | `core/pipe/pipe-serialize.ts` | ✅ JSON 라운드트립 |
| fold | `core/pipe/pipe-fold.ts` | ✅ collectFlowSteps |
| 벤치마크 | `core/pipe/pipe-benchmark.test.ts` | ✅ allFlowKinds 30종 |
| TransitionDef | `event-catalog/transition.ts` | ✅ registry + validateTransitionEvents |
| 브릿지 | `core/catalog/transition-bridge.ts` | ✅ 좌표↔제어 흐름 검증 |
| 카탈로그 | `pipe-flow-catalog.spec.md` | ✅ 30번째, transactional 분류 |
| 테스트 | 6개 파일 | ✅ 총 35건 (pipe 13 + bridge 14 + event 8) |
