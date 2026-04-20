---
def:
  id: rlsc-intent
  level: leaf
  tier: component
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
    - target: rlsc-pattern
      type: depends_on
---

## 목적 ^purpose

`LayoutPattern`을 공유 어휘로 삼아 설계 의도 선언(top-down)과 DOM 인식(bottom-up) 양 방향을
같은 구조로 표현하고, 두 패턴을 비교하여 레이아웃 프레임 위반을 탐지한다.

```
선언 경로 (설계자):  LayoutPattern { gridPattern: "3x3", flowDirection: "left-to-right" }
                                                     ↓ checkConformance
인식 경로 (DOM):     classifyLayout(measureLayout(doc)) → LayoutPattern { gridPattern: "3x3", ... }
```

선언 없이 인식만 실행해도 의미가 있다 — "이 페이지가 어떤 패턴인가"를 자동 분류한다.

## 정의 ^defines

**타입**

> `LayoutPattern` 및 하위 타입(GridSystemPattern, SpacingPattern, ProportionPattern, GestaltPattern)은 `rlsc-pattern` 참조.

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

## 소비 ^consumes

- `packages/rlsc/src/types.ts` — RLSCDocument, LayoutMetrics, LayoutPattern, ConformanceViolation, ConformanceResult
- `packages/rlsc/src/metrics.ts` — measureLayout
- `packages/rlsc/src/pattern.ts` — classifyLayout

## 구현 항목

- [x] `ConformanceViolation`, `ConformanceResult` 타입 — `types.ts`에 추가 (패턴 타입은 `rlsc-pattern`이 담당)
- [x] `intent.ts` 파일 생성 — `checkConformance`, `recognizeLayout` + 내부 체커 구현
  - 페이지 수준: `checkBalance`, `checkGrid`, `checkFlow`, `checkGoldenRatio`, `checkGestalt`
  - 구조 단위: `checkGridSystem`, `checkSpacing`, `checkProportions`
- [x] `index.ts` — `checkConformance`, `recognizeLayout`, `LayoutPattern`, `ConformanceResult` + 새 패턴 타입 export 추가
- [x] `intent.test.ts` — 양 방향 사용 검증 — 2026-04-05 완료
  - 시나리오: `rlsc-intent-test`
  - `checkConformance(doc, { gridSystem: { columns: 12, gutter: 16 } })` + 실측 6-col → gridSystem violation
  - `checkConformance(doc, { spacing: { base: 8, consistent: true } })` + 실측 base=null → spacing violation
  - 선언 필드 모두 일치 → score 1.0
  - 선언 없음 (`{}`) → score 1.0, violations []
