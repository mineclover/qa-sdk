---
def:
  id: pipe-interpret
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-analyze
      type: depends_on
  source: packages/core/src/pipe/pipe-interpret.ts
---

# PipeGraph 해석 — 관심사 추출/전파 + 영향 분석 + 역할 분류

## 목적 ^purpose

PipeGraph의 PipeFlow 구조에서 **실행 관심사를 자동 추출**하고,
ConnectionKind 연결을 따라 **BFS로 전파**하며,
변경 시 **영향 범위를 분석**한다.

definition-catalog에 매핑하지 않고, PipeGraph 도메인의 고유 용어로 동작한다.

## 정의 ^defines

- PipeConcern 8종 (flow 패턴에서 자동 추출)
- PIPE_PROPAGATION_RULES (ConnectionKind × PipeConcern × 방향)
- 전이적 전파 축소 (concern 교집합으로 체인 전파 시 좁아짐)
- PipeRole 5종 분류

## 소비 ^consumes

- `PipeSpec`, `PipeGraph`, `PipeFlow`, `ConnectionKind` (pipe-spec.ts)
- `getChildFlows` (pipe-analyze.ts)
- `normalize`, `collectFlowSteps` (pipe-fold.ts)

---

## PipeConcern 8종

| flow 패턴 | PipeConcern |
|-----------|-------------|
| retry, circuit-breaker, fallback | `resilience` |
| timeout, await, step.timeout | `latency` |
| parallel, race | `concurrency` |
| accesses mode:"write"\|"readwrite" | `data-mutation` |
| accesses mode:"read"\|"readwrite" | `data-read` |
| emit, correlation | `async-coupling` |
| dedup, filter | `data-filtering` |
| tap | `observability` |

## 전파 규칙

모든 연결에서 concern은 **화살표 방향(from→to)으로 전파**된다.
direction 필드는 메인 데이터 흐름 대비 전파 방향을 기술하는 메타데이터.

| ConnectionKind | direction | 전파하는 concern |
|---------------|-----------|-----------------|
| next | downstream | resilience, latency, data-mutation |
| conditional | downstream | latency |
| event | downstream | async-coupling |
| error | downstream | resilience |
| compensate | bidirectional | resilience, data-mutation |
| fan-out | downstream | concurrency, latency |
| join | downstream | concurrency, latency |
| feedback | upstream | latency |

### 전이적 전파 축소

체인 전파 시 **교집합**으로 좁아진다:

```
A(retry) --next--> B --conditional--> C

next 전파: [resilience, latency, data-mutation]
conditional 전파: [latency]
교집합: [latency]

→ C는 latency만 상속. resilience는 conditional에서 차단됨.
```

## PipeRole 5종

| 조건 (우선순위 순) | 역할 |
|-------------------|------|
| tap + produces 없음 + emit 없음 | observer |
| branch + data access 없음 | router |
| produces 있음 | transformer |
| emit 있음 | producer |
| 기본 | consumer |

## 구현 소스

- `packages/core/src/pipe-interpret.ts`
- 테스트: `pipe-interpret.test.ts` (23건), `pipe-interpret-gate.test.ts` (퀄리티 게이트 10건)
