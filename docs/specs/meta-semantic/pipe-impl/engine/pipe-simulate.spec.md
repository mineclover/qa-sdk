---
def:
  id: pipe-simulate
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: depends_on
    - target: pipe-path
      type: depends_on
    - target: ms-concept-event
      type: implements
  source: packages/core/src/pipe/pipe-simulate.ts
---

# PipeGraph 시뮬레이션 엔진

## 목적 ^purpose

PipeGraph를 가상 실행하여 경로 탐색과 이벤트 체인을 시뮬레이션한다.
두 가지 용도:
**(a) 실제 동작 시뮬** — resolver로 분기/실패 시나리오를 주입하여 경로 탐색.
**(b) 의도된 happy path 검증** — 설계자가 등록한 정상 경로와 시뮬 결과를 비교하여 설계 의도 검증.

## 관련 소스

- `packages/core/src/pipe-simulate.ts` — simulate()
- `packages/core/src/pipe-simulate.test.ts` — 38 테스트

## API

```typescript
simulate(config: SimulationConfig): SimulationResult
```

### SimulationConfig

| 필드 | 설명 |
|------|------|
| graph | 실행할 PipeGraph |
| initialEvent | 초기 트리거 이벤트 |
| branchResolver? | branch/conditional 경로 선택 (기본: 0) |
| filterResolver? | filter/optional/dedup 통과 판정 (기본: true) |
| raceResolver? | race 승자 선택 (기본: 0) |
| maxSteps? | 무한 루프 방지 (기본: 1000) |

### SimulationResult

| 필드 | 설명 |
|------|------|
| steps[] | 실행된 스텝 (시간순, flowPath 포함) |
| pipeTrace | 파이프 실행 순서 |
| facetTrace | 패싯 실행 순서 |
| producedEvents | 생산된 이벤트 |
| status | complete / max-steps-reached / no-trigger-match |
| totalTime | 시뮬레이션 소요 시간 (ms) |
| totalSteps | 총 실행 스텝 수 |

### 시뮬레이션 특성

- 이벤트 체인: produces → trigger 자동 연결 (자기 참조 포함)
- 시간 시뮬: timeout/debounce/buffer의 가상 시계 진행
- 경로 선택: resolver 함수로 분기/필터/레이스 결정 주입
- 무한 루프: maxSteps로 방지, status = "max-steps-reached"
- finally: body + cleanup 모두 실행
- tap: observe + step 모두 실행 (관측은 흐름에 영향 없음)

### 연산자 동작 안정화

| 연산자 | 동작 | 비고 |
|--------|------|------|
| loop | maxIterations까지 body 반복, until 조건 체크 | until 조건 만족 시 조기 종료 |
| tap | observe 에러 격리 (try/catch), step은 항상 실행 | 관측 실패가 흐름을 차단하지 않음 |
| dedup | Set으로 keyField 값 추적, 중복 시 skip | 첫 등장만 통과 |
| filter | 조건 false 시 "filtered" step 기록 | filterResolver로 판정 주입 |

### Happy Path 검증

설계자가 의도한 정상 경로를 선언하고, 시뮬 결과와 비교한다.

```typescript
const match = matchHappyPath(result, {
  expectedPipeTrace: ["validate", "charge", "receipt"],
  expectedFacets: ["검증", "결제", "영수증"],  // 선택
});
// → { match: true/false, pipeTraceMatch, facetMatch, divergedAtIndex, expected, actual }
```

| 타입 | 설명 |
|------|------|
| `HappyPathSpec` | expectedPipeTrace + expectedFacets(선택) |
| `HappyPathMatch` | match, pipeTraceMatch, facetMatch, divergedAtIndex, expected, actual |
| `matchHappyPath()` | pipeTrace/facetTrace 비교 → 불일치 시 분기 지점 보고 |

TestRegistry.compareWithSimulation()으로 드리프트 감지와 연결 가능.

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-simulate.test.ts
```
