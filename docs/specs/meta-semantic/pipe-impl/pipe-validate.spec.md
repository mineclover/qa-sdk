---
def:
  id: pipe-validate
  level: leaf
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: depends_on
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

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-path.test.ts   # validate도 여기에 포함
```
