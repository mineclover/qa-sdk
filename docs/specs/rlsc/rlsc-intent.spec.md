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

`LayoutPattern`을 공유 어휘로 삼아 설계 의도 선언(top-down)과 DOM 인식(bottom-up) 양 방향을
같은 구조로 표현하고, 두 패턴을 비교하여 레이아웃 프레임 위반을 탐지한다.

```
선언 경로 (설계자):  LayoutPattern { gridPattern: "3x3", flowDirection: "left-to-right" }
                                                     ↓ checkConformance
인식 경로 (DOM):     classifyLayout(measureLayout(doc)) → LayoutPattern { gridPattern: "3x3", ... }
```

선언 없이 인식만 실행해도 의미가 있다 — "이 페이지가 어떤 패턴인가"를 자동 분류한다.

^defines

**타입**

- `LayoutPattern` — 레이아웃 패턴 어휘 (선언과 인식 공유)

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
  - `margin?: number` — 외곽 여백 (px). 응답형에서는 뷰포트 기준
  - `rowGap?: number` — 행 간 gap (px)
  - `columnWidthPx?: number` — 단일 컬럼 폭 (px). `(viewport - margin×2 - gutter×(cols-1)) / cols`

- `SpacingPattern` — 여백·간격 패턴
  - `base?: number` — 기본 단위 (예: 4 또는 8 → 4px/8px 배수 시스템)
  - `scale: number[]` — 감지된 간격 값 목록 (오름차순). 예: `[4, 8, 16, 24, 32]`
  - `consistent: boolean` — `base`의 배수로만 구성되면 true

- `ProportionPattern` — 요소 비율 패턴
  - `dominant?: number` — 가장 빈번한 가로세로 비율 (소수). 예: 1.78 ≈ 16:9
  - `namedRatio?: "1:1" | "4:3" | "16:9" | "golden" | "2:1" | "3:1"` — 알려진 비율 매칭
  - `distribution: { ratio: number, count: number }[]` — 전체 분포 (count 내림차순)

- `GestaltPattern` — 게슈탈트 관련 패턴
  - `proximity?: "tight" | "loose"` — 근접 그룹 간격 기대치
    - tight: gapThreshold ≤ 16px
    - loose: gapThreshold ≤ 64px
  - `continuity?: "strong" | "weak"` — flow 연결 밀도
    - strong: flow relations ≥ 가시 노드 수의 50%
    - weak: flow relations ≥ 가시 노드 수의 20%
  - `minGroupCount?: number` — proximity group 수 하한

- `ConformanceViolation` — 위반 항목
  - `rule: string` — 규칙 이름 (예: "balance.x", "gridPattern", "flowDirection")
  - `declared: unknown` — 선언값 (top-down)
  - `recognized: unknown` — 인식값 (bottom-up)
  - `severity: "error" | "warning"`
  - `description: string`

- `ConformanceResult` — 검증 결과
  - `declared: LayoutPattern` — 선언된 패턴 (입력)
  - `recognized: LayoutPattern` — DOM에서 인식된 패턴 (`classifyLayout` 결과)
  - `metrics: LayoutMetrics` — 인식 과정의 raw 수치 (디버깅용)
  - `violations: ConformanceViolation[]`
  - `score: number` — 0–1 (선언된 필드 중 일치 비율, 선언 없으면 1.0)

**함수**

- `packages/rlsc/src/intent.ts:checkConformance` — `(doc: RLSCDocument, declared: LayoutPattern) → ConformanceResult`
  - `measureLayout(doc)` → `classifyLayout(metrics)` → `recognized: LayoutPattern`
  - 선언된 필드만 비교 (미선언 필드는 위반 생성 안 함)
  - score = `(위반 없는 필드 수) / (선언된 필드 수)`, 선언 없으면 1.0

- `packages/rlsc/src/intent.ts:recognizeLayout` — `(doc: RLSCDocument) → LayoutPattern`
  - 선언 없이 DOM만으로 패턴 인식 (`measureLayout` + `classifyLayout` 래퍼)
  - 단독 사용: "이 페이지가 어떤 레이아웃 패턴인가?"

- 내부 체커 (모두 `declared` vs `recognized` 필드 비교):
  - `checkBalance(declared, recognized) → ConformanceViolation[]`
    - `[a, b]` → 기대 비율 `a/b` vs `recognized.balanceRatio.x`
    - 허용 편차: ±20% → warning, ±50% 초과 → error
  - `checkGrid(declared, recognized) → ConformanceViolation[]`
    - `"3x3"` → `{ cols: 3, rows: 3 }` 변환 후 비교
  - `checkFlow(declared, recognized) → ConformanceViolation[]`
    - `"left-to-right"` → `recognized.flowDirection === "left-to-right"` 기대
  - `checkGoldenRatio(declared, recognized) → ConformanceViolation[]`
    - `declared.goldenRatio === true` + `recognized.goldenRatio !== true` → warning
  - `checkGestalt(declared, recognized) → ConformanceViolation[]`

^consumes

- `packages/rlsc/src/types.ts` — RLSCDocument, LayoutMetrics
- `packages/rlsc/src/metrics.ts` — measureLayout, classifyLayout

## 구현 항목

- [ ] `LayoutPattern`, `GridSystemPattern`, `SpacingPattern`, `ProportionPattern`, `GestaltPattern`, `ConformanceViolation`, `ConformanceResult` 타입 — `types.ts`에 추가
- [ ] `intent.ts` 파일 생성 — `checkConformance`, `recognizeLayout` + 내부 체커 구현
  - 페이지 수준: `checkBalance`, `checkGrid`, `checkFlow`, `checkGoldenRatio`, `checkGestalt`
  - 구조 단위: `checkGridSystem`, `checkSpacing`, `checkProportions`
- [ ] `index.ts` — `checkConformance`, `recognizeLayout`, `LayoutPattern`, `ConformanceResult` + 새 패턴 타입 export 추가
- [ ] `intent.test.ts` — 양 방향 사용 검증
  - `recognizeLayout(doc)` 만 호출 → violations 없이 LayoutPattern 반환
  - `checkConformance(doc, { gridPattern: "3x3" })` + 실측 2×2 → gridPattern violation
  - `checkConformance(doc, { balanceRatio: { x: [2, 1] } })` + 실측 1.05 → balance.x violation
  - `checkConformance(doc, { gridSystem: { columns: 12, gutter: 16 } })` + 실측 6-col → gridSystem violation
  - `checkConformance(doc, { spacing: { base: 8, consistent: true } })` + 실측 base=null → spacing violation
  - 선언 필드 모두 일치 → score 1.0
  - 선언 없음 (`{}`) → score 1.0, violations []
