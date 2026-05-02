---
def:
  id: rlsc-pattern-test
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-pattern
      type: verifies
  source: packages/rlsc/src/pattern.test.ts
---

## 목적 ^purpose

`classifyLayout`이 `LayoutMetrics` 수치를 `LayoutPattern` 어휘로 올바르게 변환하는지 검증한다.
mock LayoutMetrics를 주입하여 각 필드의 분류 로직을 독립적으로 테스트한다.

소스: `packages/rlsc/src/pattern.test.ts`

## gridPattern

| 시나리오 | 기대 결과 |
|----------|----------|
| `gridPattern: null` | 필드 생략 |
| `{cols:3, rows:3}` | `"3x3"` |
| `{cols:1, rows:1}` | `"1-col"` |
| `{cols:2, rows:1}` | `"2-col"` |
| `{cols:4, rows:2}` | `{cols:4, rows:2}` (객체 그대로) |

## flowDirection

| 시나리오 | 기대 결과 |
|----------|----------|
| `dominantFlow: "horizontal"` | `"left-to-right"` |
| `"vertical"` | `"top-to-bottom"` |
| `"grid"` | `"grid"` |
| `"free"` | 필드 생략 |

## goldenRatio

| 시나리오 | 기대 결과 |
|----------|----------|
| `goldenRatioScore: 0.9` (≥ 0.8) | `goldenRatio: true` |
| `goldenRatioScore: 0.5` (< 0.8) | 필드 생략 |

## balanceRatio

| 시나리오 | 기대 결과 |
|----------|----------|
| `balance.x: 1.0` (균형) | 필드 생략 |
| `balance.x: 3.0` (치우침) | `balanceRatio.x` 설정 |

## gestalt

| 시나리오 | 기대 결과 |
|----------|----------|
| 2그룹, 평균 거리 ≤ 16 | `gestalt.proximity: "tight"` |
| 2그룹, 평균 거리 17–64 | `gestalt.proximity: "loose"` |
| 1그룹 | 필드 생략 |

## gridSystem

| 시나리오 | 기대 결과 |
|----------|----------|
| `columnSystem: {cols:12, gutterPx:24, marginPx:32}` | `gridSystem.columns=12`, `gutter=24`, `margin=32` |
| `columnSystem: null` | 필드 생략 |

## spacing

| 시나리오 | 기대 결과 |
|----------|----------|
| `spacingValues:[8,16,24]`, `spacingBase:8` | `spacing.base=8`, `consistent:true`, `scale=[8,16,24]` |
| `spacingValues:[]` | 필드 생략 |

## proportions

| 시나리오 | 기대 결과 |
|----------|----------|
| dominant ratio ≈ 1.618 | `namedRatio: "golden"` |
| dominant ratio ≈ 1.78 | `namedRatio: "16:9"` |
| `aspectRatioDistribution: []` | 필드 생략 |
