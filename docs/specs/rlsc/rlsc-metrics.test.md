---
def:
  id: rlsc-metrics-test
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-metrics
      type: verifies
  source: packages/rlsc/src/metrics.test.ts
---

## 목적 ^purpose

`metrics.ts` 8종 측정 함수와 `measureLayout` 통합 동작을 DOM 없이 검증한다.
mock 노드와 관계를 주입하여 순수 함수로 테스트한다.

소스: `packages/rlsc/src/metrics.test.ts`

## measureBalance

| 시나리오 | 기대 결과 |
|----------|----------|
| 좌우 면적 동일 | `x ≈ 1.0` |
| 왼쪽 노드가 오른쪽보다 큰 면적 | `x > 1` |
| 비가시 노드 포함 | 비가시 노드 제외 후 계산 |
| 한쪽 면적 0 | `x = 99` (관례값) |

## scoreGoldenRatio

| 시나리오 | 기대 결과 |
|----------|----------|
| 뷰포트 1618:1000 | score > 0.9 |
| 정사각형 1000:1000 | score < 0.7 (≈ 0.618) |
| 0 크기 뷰포트 | score = 0 |
| 임의 뷰포트 | score ∈ [0, 1] |

## detectProximityGroups

| 시나리오 | 기대 결과 |
|----------|----------|
| 3개 노드, 모두 근접 (gapThreshold=100) | 그룹 1개, nodeIds 3개 |
| 두 노드 500px 이격 | 그룹 2개 |
| 비가시 노드 포함 | 비가시 노드 제외 |

## detectDominantFlow

| 시나리오 | 기대 결과 |
|----------|----------|
| adjacent-x 2개, adjacent-y 1개 | "horizontal" |
| adjacent-y 2개 | "vertical" |
| adjacent-x 1개 + adjacent-y 1개 | "grid" |
| 관계 없음 | "free" |

## measureSpacing

| 시나리오 | 기대 결과 |
|----------|----------|
| adjacent-x, gap=8px | `values=[8]`, `base=8` |
| adjacent-y, gap=16px | `values=[16]`, `base=8` |
| 관계 없음 | `values=[]`, `base=null` |

## measureAspectRatios

| 시나리오 | 기대 결과 |
|----------|----------|
| 동일 비율(2.0) 노드 2개 + 비율(1.0) 노드 1개 | `dist[0].ratio=2, count=2` (count 내림차순) |
| 비가시 또는 0-크기 노드 포함 | 해당 노드 제외 |

## detectColumnSystem

| 시나리오 | 기대 결과 |
|----------|----------|
| 두 x 클러스터 (x=0, x=500) | `cs.cols=2` |
| 노드 없음 | null |

## detectGridPattern

| 시나리오 | 기대 결과 |
|----------|----------|
| dominant 없는 그리드 | null |
| 2-col 배치 (root=invisible, cellSize=10, tolerance=20) | `{cols:2, rows:1}` |

## measureLayout — 통합

| 시나리오 | 기대 결과 |
|----------|----------|
| 2개 노드 RLSCDocument | balance.x `number`, goldenRatioScore ∈ [0,1], spacingValues `array` |
