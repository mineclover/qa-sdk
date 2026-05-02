---
def:
  id: pipe-validate
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
  source: packages/core/src/pipe/pipe-validate.ts
---

# PipeSpec / PipeGraph 구조 검증

## 목적 ^purpose

PipeSpec 내부 흐름과 PipeGraph 연결 구조의 무결성을 검증한다.
`validatePipeSpec()`은 12종 규칙, `validatePipeGraph()`는 10종 규칙.

## 관련 소스

- `packages/core/src/pipe-validate.ts` — validatePipeSpec, validatePipeGraph

## PipeSpec 검증 규칙

| 규칙 | 심각도 |
|------|--------|
| empty-sequence/branch/parallel/race | error |
| retry-zero, timeout-zero, cb-threshold-zero | error |
| missing-trigger | error |
| loop-no-limit, feedback-no-limit | warning |
| missing-facet | warning |
| deep-nesting > 8 | warning |
| buffer-no-config | warning |

## PipeGraph 검증 규칙

| 규칙 | 심각도 |
|------|--------|
| missing-entry | error |
| dangling-connection | error |
| duplicate-pipe-id | error |
| join-incomplete | error |
| unreachable-pipe | warning |
| fan-out-single, join-single | warning |
| event-mismatch | warning |
| feedback-no-convergence | warning |

### 추가 검증 규칙 (연산자 안정화)

#### 빈 from/to 배열

| 규칙 | 심각도 | 설명 |
|------|--------|------|
| empty-from | warning | from 배열이 비어있음 |
| empty-to | warning | to 배열이 비어있음 |

#### 숫자 범위 검증

| 연산자 | 필드 | 조건 | 심각도 |
|--------|------|------|--------|
| timeout | duration | > 0 | error |
| circuit-breaker | cooldown | > 0 | error |
| circuit-breaker | failureThreshold | > 0 | error |
| window | size | > 0 | error |
| retry | maxAttempts | > 0 | error |
| retry | backoff | >= 0 | error |
| throttle | rate | > 0 | error |
| throttle | interval | > 0 | error |
| debounce | wait | > 0 | error |
| dedup | ttl | > 0 | error |
| buffer | count | > 0 | error |
| buffer | duration | > 0 | error |

#### 의미적 검증

| 규칙 | 심각도 | 설명 |
|------|--------|------|
| correlation-same-event | warning | correlation.requestEvent !== responseEvent 위반 (같은 이벤트) |
| enrich-empty-source | warning | enrich.source가 비어있음 |
| map-empty-collection | warning | map.collection이 비어있음 |
| split-empty-splitBy | warning | split.splitBy가 비어있음 |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-path.test.ts   # validate도 여기에 포함
```
