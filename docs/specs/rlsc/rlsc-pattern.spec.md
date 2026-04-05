---
def:
  id: rlsc-pattern
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: domain
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
    - target: rlsc-metrics
      type: depends_on
---

## 목적 ^purpose

`LayoutMetrics`(수치)를 `LayoutPattern`(패턴 어휘)으로 분류하고, 패턴 타입 어휘를 정의한다.
`LayoutPattern`은 선언(top-down 설계 의도)과 인식(bottom-up DOM 수집) 양방향에서 공유하는 중립 타입이다.
수치를 해석하는 단계(`metrics`)와 선언 대 인식을 비교하는 단계(`intent`) 사이의 중재 계층.

## 정의 ^defines

**타입**

- `LayoutPattern` — 레이아웃 패턴 어휘 (선언·인식 공유)

  *페이지 수준*
  - `gridPattern?: "3x3" | "2-col" | "1-col" | { cols: number, rows: number }` — 도미넌트 영역 배치
  - `balanceRatio?: { x?: [number, number], y?: [number, number] }` — `[좌, 우]` 비율. 예: `[2, 1]`
  - `flowDirection?: "left-to-right" | "right-to-left" | "top-to-bottom" | "grid"`
  - `goldenRatio?: boolean`
  - `gestalt?: GestaltPattern`

  *구조 단위 수준*
  - `gridSystem?: GridSystemPattern` — 컬럼 그리드 시스템 (12-col 등)
  - `spacing?: SpacingPattern` — 여백·간격 패턴
  - `proportions?: ProportionPattern` — 요소 비율 패턴

- `GridSystemPattern` — 컬럼 기반 그리드 시스템
  - `columns: number` — 컬럼 수 (1, 2, 3, 4, 6, 8, 12)
  - `gutter: number` — 컬럼 간 gap (px)
  - `margin?: number` — 외곽 여백 (px)
  - `rowGap?: number` — 행 간 gap (px)
  - `columnWidthPx?: number` — 단일 컬럼 폭 `(viewport - margin×2 - gutter×(cols-1)) / cols`

- `SpacingPattern` — 여백·간격 패턴
  - `base?: number` — 기본 단위 (예: 4 또는 8 → 배수 시스템)
  - `scale: number[]` — 감지된 간격 값 목록 (오름차순)
  - `consistent: boolean` — `base` 배수로만 구성되면 true

- `ProportionPattern` — 요소 비율 패턴
  - `dominant?: number` — 가장 빈번한 가로세로 비율. 예: 1.78 ≈ 16:9
  - `namedRatio?: "1:1" | "4:3" | "16:9" | "golden" | "2:1" | "3:1"` — 알려진 비율 매칭
  - `distribution: { ratio: number, count: number }[]` — 전체 분포

- `GestaltPattern` — 게슈탈트 관련 패턴
  - `proximity?: "tight" | "loose"` — tight: gapThreshold ≤ 16px, loose: ≤ 64px
  - `continuity?: "strong" | "weak"` — strong: flow ≥ 가시 노드 50%, weak: ≥ 20%
  - `minGroupCount?: number` — proximity group 수 하한

**함수**

- `packages/rlsc/src/pattern.ts:classifyLayout` — `(metrics: LayoutMetrics) → LayoutPattern`
  - `LayoutMetrics` 수치를 패턴 어휘로 변환 (bottom-up 인식 경로)

  *페이지 수준 분류*
  - `gridPattern`: `metrics.gridPattern` → `{ cols, rows }` 또는 축약 레이블("3x3", "2-col", "1-col")
  - `balanceRatio.x`: `metrics.balance.x` → 가장 가까운 정수 비율 `[a, 1]`
  - `flowDirection`: `metrics.dominantFlow` → `"horizontal"→"left-to-right"`, `"vertical"→"top-to-bottom"`, `"grid"→"grid"`
  - `goldenRatio`: `metrics.goldenRatioScore ≥ 0.8` → `true`

  *구조 단위 수준 분류*
  - `gridSystem`: `metrics.columnSystem` → `GridSystemPattern` (null이면 생략)
  - `spacing`: `metrics.spacingValues` + `metrics.spacingBase` → `SpacingPattern`
  - `proportions`: `metrics.aspectRatioDistribution` 상위 3개 → 알려진 비율 매칭 후 `ProportionPattern`

  분류 불가 필드는 결과에서 생략

## 소비 ^consumes

- `packages/rlsc/src/types.ts` — LayoutMetrics
- `packages/rlsc/src/metrics.ts` — LayoutMetrics (입력 타입)

## 구현 항목

- [x] `LayoutPattern`, `GridSystemPattern`, `SpacingPattern`, `ProportionPattern`, `GestaltPattern` 타입 — `types.ts`에 추가
- [x] `pattern.ts` 파일 생성 — `classifyLayout` 구현
- [x] `index.ts` — `classifyLayout`, 패턴 타입 5종 export 추가
- [x] `pattern.test.ts` — `classifyLayout` 단위 테스트 (mock LayoutMetrics) — 2026-04-05 완료
  - 시나리오: `rlsc-pattern-test`
  - spacingValues `[8, 16, 24]`, base 8 → spacing.consistent true
  - aspectRatioDistribution 1위 1.78 → namedRatio "16:9"
