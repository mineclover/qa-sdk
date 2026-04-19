---
def:
  id: rlsc
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  level: module
  layer: mediation
  svc: rlsc
  tags: [runtime, structural, observability]
  links:
    - target: rlsc-collector
      type: contains
    - target: rlsc-grid
      type: contains
    - target: rlsc-layers
      type: contains
    - target: rlsc-relations
      type: contains
    - target: rlsc-encoder
      type: contains
    - target: rlsc-context
      type: contains
    - target: rlsc-query
      type: contains
    - target: rlsc-metrics
      type: contains
    - target: rlsc-pattern
      type: contains
    - target: rlsc-intent
      type: contains
    - target: rlsc-canvas
      type: contains
    - target: rlsc-monitor
      type: contains
    - target: rlsc-test
      type: contains
  source: packages/rlsc/src/index.ts
---

# R.L.S.C.™ — Relative Layout Structured Content

## 목적 ^purpose

DOM과 레이어 구조를 통일된 뷰포트 좌표계로 수집하고, 설계자가 선언한 레이아웃 프레임(3×3 그리드, 2:1 균형, 좌→우 흐름 등)에 실제 구현이 부합하는지 검증한다. 게슈탈트 원칙·황금비 측정값을 MutationObserver/ResizeObserver 루프와 연결하여 실시간 적합성 피드백을 제공한다. LLM Context Engineering 주입도 부가 출력으로 지원한다.

## 수집과 해석의 분리 원칙

**수집(Collection)** 은 좌표계 데이터만 담는다. 해석은 하지 않는다.
**해석(Interpretation)** 은 수집된 좌표에서 의미를 끌어낸다.

```
수집   RLSCNode  { x, y, width, height, zIndex, depth }   ← 좌표계. 해석 없음
         ↓
해석1  LayoutMetrics  { balance, columnSystem, spacing, ... }  ← 기하에서 수치 추출
         ↓
해석2  LayoutPattern  { gridPattern, gridSystem, flowDirection, ... } ← 수치를 패턴 어휘로 분류
         ↓
검증   ConformanceResult  { declared vs recognized, violations }
```

수집 단계가 "이게 그리드인가"를 판단하지 않는다. 좌표만 기록하고, 해석은 `measureLayout` + `classifyLayout`이 담당한다.

## 파이프라인 ^overview

```
DOM (브라우저)
  └─ collectLayout()         → RLSCDocument          [수집: 좌표계]
       ├─ analyzeGrid()        → LayoutGrid           [수집: 셀 행렬]
       ├─ classifyLayers()     → LayerStack[]         [수집: z 레이어]
       └─ detectRelations()    → RLSCRelation[]       [수집: 공간 관계]
            ↓
       measureLayout()        → LayoutMetrics         [해석1: 수치]       ← ✓
            ↓
       classifyLayout()       → LayoutPattern         [해석2: 패턴 어휘]  ← ✓ (rlsc-pattern)
            ↓
       checkConformance()     → ConformanceResult     [검증]              ← ✓
            │
       LayoutMonitor          → 실시간 재검증 루프    [관측]              ← ✓
            ↓
       renderToCanvas/SVG     → 시각적 구조 이미지    [시각화]            ← ✓
            ↓
       encodeToMarkup()       → RLSC/1.0 마크업       [직렬화]
            ↓
       generateDesignContext() → DesignContext.prompt → LLM
```

소스: `packages/rlsc/src/`

## 좌표계 통일 원칙

- 모든 노드는 뷰포트 기준 `(x, y, width, height)` + `zIndex` 로 표현된다
- stacking context, fixed/absolute/sticky 위치, iframe 레이어 — 모두 동일 평면에 투영
- z축은 레이어 겹침 순서를 표현하며, 동일 x/y 평면에서 zStack으로 관리된다
- 수집 단계에서 `role`, `display`, `position` 은 CSS/ARIA 원본값 그대로 — 해석(카테고리화) 하지 않음

## 위임 ^delegates

| 관심사 | 문서 | 소스 | 상태 |
|--------|------|------|------|
| DOM 수집 + 역할 추론 | `rlsc-collector` | `collector.ts`, `tree-utils.ts` | ✓ |
| 뷰포트 셀 행렬 분석 | `rlsc-grid` | `grid.ts` | ✓ |
| z-index 레이어 분류 | `rlsc-layers` | `layers.ts` | ✓ |
| 8종 공간 관계 탐지 | `rlsc-relations` | `relations.ts` | ✓ |
| 마크업 직렬화/파싱 | `rlsc-encoder` | `encoder.ts` | ✓ |
| LLM 프롬프트 생성 | `rlsc-context` | `context.ts` | ✓ |
| 쿼리/불변 갱신/diff | `rlsc-query` | `query.ts` | ✓ |
| 설계 메트릭 계산 | `rlsc-metrics` | `metrics.ts` | ✓ |
| 패턴 어휘 분류 | `rlsc-pattern` | `pattern.ts` | ✓ |
| 의도 선언 + 프레임 검증 | `rlsc-intent` | `intent.ts` | ✓ |
| 색상 매핑 캔버스 렌더링 | `rlsc-canvas` | `canvas.ts` | ✓ |
| DOM 변화 관측 + 재검증 루프 | `rlsc-monitor` | `monitor.ts` | ✓ |
| 테스트 시나리오 묶음 | `rlsc-test` | `*.test.md` | mixed |

## 제약 ^consumes

- `packages/rlsc/src/index.ts` — public export barrel
- `packages/platform-demo/public/rlsc.html` — Inspector UI (npm 패키지 미연결)
- 브라우저 전용 (`collectLayout`, `LayoutMonitor`). 서버 호환: `renderToSVG`, `checkConformance`
