---
def:
  id: rlsc-intent
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
    - target: rlsc-metrics
      type: depends_on
---

^purpose

설계 의도를 선언적으로 표현하고, 측정된 LayoutMetrics와 비교하여 레이아웃 프레임 위반을 탐지한다.
"3×3 그리드로 구성한다", "좌:우 = 2:1 균형을 유지한다", "좌→우 흐름으로 스크롤된다"와 같은
설계 프레임을 코드 수준에서 검증 가능한 형태로 정의한다.

^defines

**타입**

- `LayoutIntent` — 설계 의도 선언
  - `gridPattern?: "3x3" | "2-col" | "1-col" | { cols: number, rows: number }`
  - `balanceRatio?: { x?: [number, number], y?: [number, number] }` — `[좌, 우]` 비율. 예: `[2, 1]`
  - `flowDirection?: "left-to-right" | "right-to-left" | "top-to-bottom" | "grid"`
  - `goldenRatio?: boolean` — 황금비 준수 여부 (score ≥ 0.8이면 통과)
  - `gestalt?: GestaltIntent`

- `GestaltIntent` — 게슈탈트 의도
  - `proximity?: "tight" | "loose"` — 근접 그룹 간격 기대치
    - tight: gapThreshold ≤ 16px (ADJACENCY_GAP 이내)
    - loose: gapThreshold ≤ 64px
  - `continuity?: "strong" | "weak"` — flow 연결 밀도
    - strong: flow relations ≥ 가시 노드 수의 50%
    - weak: flow relations ≥ 가시 노드 수의 20%
  - `minGroupCount?: number` — 최소 proximity group 수 (기본: 검사 안 함)

- `ConformanceViolation` — 위반 항목
  - `rule: string` — 규칙 이름 (예: "balance.x", "gridPattern", "flowDirection")
  - `expected: unknown` — 의도값
  - `actual: unknown` — 측정값
  - `severity: "error" | "warning"`
  - `description: string` — 사람이 읽을 수 있는 설명

- `ConformanceResult` — 검증 결과
  - `intent: LayoutIntent`
  - `metrics: LayoutMetrics`
  - `violations: ConformanceViolation[]`
  - `score: number` — 0–1 (1 = 모든 규칙 통과, 위반 없음)

**함수**

- `packages/rlsc/src/intent.ts:checkConformance` — `(doc: RLSCDocument, intent: LayoutIntent) → ConformanceResult`
  - `measureLayout(doc)` 호출 후 내부 체커 순서대로 실행
  - score = `(통과 규칙 수) / (전체 선언된 규칙 수)`, 규칙 없으면 1.0

- `packages/rlsc/src/intent.ts:checkBalance` — `(metrics, intent) → ConformanceViolation[]` (내부)
  - `intent.balanceRatio.x` 있으면 `[a, b]` → 기대 비율 `a/b` vs `metrics.balance.x`
  - 허용 편차: ±20% (기본). 초과 시 warning, ±50% 초과 시 error

- `packages/rlsc/src/intent.ts:checkGrid` — `(metrics, intent) → ConformanceViolation[]` (내부)
  - `"3x3"` → `{ cols: 3, rows: 3 }` 변환 후 비교
  - `metrics.gridPattern` null이면 error

- `packages/rlsc/src/intent.ts:checkFlow` — `(metrics, intent) → ConformanceViolation[]` (내부)
  - `"left-to-right"` → `dominantFlow === "horizontal"` 기대
  - `"top-to-bottom"` → `dominantFlow === "vertical"` 기대
  - `"grid"` → `dominantFlow === "grid"` 기대

- `packages/rlsc/src/intent.ts:checkGoldenRatio` — `(metrics, intent) → ConformanceViolation[]` (내부)
  - `intent.goldenRatio === true` → `metrics.goldenRatioScore < 0.8` 시 warning

- `packages/rlsc/src/intent.ts:checkGestalt` — `(metrics, intent) → ConformanceViolation[]` (내부)
  - proximity "tight": gapThreshold 16px 기준 그룹이 존재해야 함
  - continuity "strong": `flow` relations 비율 ≥ 0.5

^consumes

- `packages/rlsc/src/types.ts` — RLSCDocument
- `packages/rlsc/src/metrics.ts` — measureLayout, LayoutMetrics

## 구현 항목

- [ ] `LayoutIntent`, `GestaltIntent`, `ConformanceViolation`, `ConformanceResult` 타입 — `types.ts`에 추가
- [ ] `intent.ts` 파일 생성 — `checkConformance` + 내부 체커 5종 구현
- [ ] `index.ts` — `checkConformance`, `LayoutIntent`, `ConformanceResult` export 추가
- [ ] `intent.test.ts` — 의도 선언별 위반 탐지 단위 테스트
  - 3x3 의도 + 2x2 실측 → gridPattern violation
  - balance [2,1] 의도 + 실측 1.05 → balance.x violation
  - flowDirection "left-to-right" + dominantFlow "vertical" → flowDirection violation
  - 모든 규칙 통과 → score 1.0
