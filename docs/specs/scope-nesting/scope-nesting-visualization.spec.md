---
def:
  id: scope-nesting-visualization
  scope: ui
  aspect: component
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [visualization, testing]
  links:
    - target: scope-nesting-system
      type: refines
    - target: scope-nesting-simulation-layers
      type: depends_on
    - target: scope-nesting-mount-flow
      type: depends_on
    - target: scope-nesting-contract-timing
      type: depends_on
---

# Scope Nesting 시각화

## 목적 ^purpose

scope-nesting의 5계층 시뮬레이션 결과를 통합 타임라인으로 렌더링하는 라이브러리 함수와 프리뷰 웹을 정의한다. 기존 pipe-svg 토큰 + canvas-viewport 추상화를 재사용하여 시각화 일관성을 확보한다.

## 정의 ^defines

- **scopeTimelineToSvg()** — ScopeNesting + SimulationResult → SVG 문자열 (서버/정적 렌더링)
- **scopeTimelineToD3()** — ScopeNesting + SimulationResult → D3 데이터 모델 (브라우저 렌더링)
- **scope-nesting 프리뷰 페이지** — viz-web 내 라이브 프리뷰

## 소비 ^consumes

- `pipe-svg-primitives` — svgRect, svgText, svgLine, svgGroup (`@qa-sdk/core`)
- `pipe-svg-shapes` — ROLE_TOKENS, EDGE_TOKENS, CONCERN_TOKENS 색상 체계 (`@qa-sdk/core`)
- `canvas-viewport` — createCanvasViewportSession, renderCanvasHud (`canvas-viewport`)
- `ScopeNesting` / `NestingValidation` / `MountSnapshot` / `TimingValidation` (`@qa-sdk/core`)
- `SimulationResult` (`@qa-sdk/core`)

---

## 아키텍처

### 기존 pipe-svg 3계층과의 관계

```
pipe-svg-primitives  (SVG 요소 빌더)
  ↑
pipe-svg-shapes     (도메인 도형 + 토큰)
  ↑
pipe-svg            (PipeGraph 렌더러)
  ↑ 병렬
scope-nesting-svg   (ScopeNesting 타임라인 렌더러)  ← 신규
  ↑
canvas-viewport     (줌/팬/미니맵)
  ↑
viz-web             (프리뷰 웹 호스트)
```

scope-nesting-svg는 pipe-svg와 **같은 계층**에 위치. primitives와 shapes를 공유하되, 렌더링 대상이 PipeGraph 대신 ScopeNesting.

### 토큰 매핑

기존 pipe-svg 토큰을 scope-nesting에 재매핑:

| pipe-svg 토큰 | scope-nesting 용도 |
|---|---|
| `ROLE_TOKENS.producer` | scope provides 배경색 |
| `ROLE_TOKENS.consumer` | scope consumes 배경색 |
| `ROLE_TOKENS.transformer` | handlers scope (소비→관리→생산) |
| `EDGE_TOKENS.event` | contract descent 엣지 |
| `EDGE_TOKENS.conditional` | optional consume 엣지 (점선) |
| `CONCERN_TOKENS.resilience` | delegation gap 구간 |
| `CONCERN_TOKENS.latency` | readyAfter pending 구간 |

신규 토큰 (scope-nesting 전용):

| 토큰 | 용도 | 색상 |
|---|---|---|
| `SCOPE_DEPTH_COLORS` | depth별 scope 배경 (0~3) | cyan, indigo, pink, orange |
| `CONTRACT_TYPE_COLORS` | state, logging, persist, adapter | blue, amber, emerald, purple |
| `FACET_COLORS` | 생산, 소비, 관리, 정의, 저장 | green, blue, yellow, purple, teal |
| `TIMING_COLORS` | pending, ready, delegation | red, green, pink |

---

## 타임라인 데이터 모델

### ScopeTimelineData (렌더링 입력)

```typescript
interface ScopeTimelineData {
  nesting: ScopeNesting;
  validation: NestingValidation;
  snapshots: MountSnapshot[];
  timing?: TimingValidation;
  simulation?: SimulationResult;
  /** pipe → scope 바인딩 */
  bindings?: Record<string, { scopeId: string; scopeContracts: string[] }>;
}
```

### ScopeTimelineRow (행 모델)

```typescript
type RowType = "scope" | "contract" | "pipe" | "delegation";

interface ScopeTimelineRow {
  type: RowType;
  id: string;
  label: string;
  /** 행 내 블록 (시간축) */
  blocks: TimelineBlock[];
}

interface TimelineBlock {
  start: number;  // step index
  end: number;
  color: string;
  opacity: number;
  label?: string;
  sublabel?: string;
  /** 수직 마커 */
  marker?: { position: number; color: string };
  /** 툴팁 데이터 */
  tooltip?: Record<string, string>;
}
```

### 행 조립 규칙

| 행 타입 | 입력 | 블록 생성 규칙 |
|---|---|---|
| scope | ScopeContract | 전체 구간 활성 바 + provides 뱃지 + facets 라벨 |
| contract | ContractRef (readyAfter) | pending 블록(0→readyAt, red) + ready 블록(readyAt→end, green) + 수직 마커 |
| pipe | PipeSpec steps | step별 블록, 패싯 색상, 이벤트 마커, 동작 라벨 |
| delegation | DelegationRef | 위임 구간 블록(start→completion, pink) + 완료 마커 |

---

## API 설계

### 1. scopeTimelineToSvg (서버/정적)

```typescript
interface ScopeTimelineSvgOptions {
  width?: number;       // 기본: 960
  rowHeight?: number;   // 기본: 36
  padding?: { top: number; bottom: number; left: number; right: number };
  /** 행 타입 필터 (미설정 시 전부 표시) */
  showRows?: RowType[];
}

function scopeTimelineToSvg(
  data: ScopeTimelineData,
  options?: ScopeTimelineSvgOptions,
): string;
```

pipe-svg의 `pipeGraphToSvg` 패턴과 동일. SVG 문자열 반환.

### 2. scopeTimelineToD3 (브라우저)

```typescript
interface D3TimelineData {
  rows: ScopeTimelineRow[];
  stepCount: number;
  width: number;
  height: number;
}

function scopeTimelineToD3(
  data: ScopeTimelineData,
  options?: ScopeTimelineSvgOptions,
): D3TimelineData;
```

pipe-svg의 `pipeGraphToD3` 패턴과 동일. D3 호환 데이터 반환.

### 3. renderScopeTimeline (브라우저 DOM)

```typescript
interface ScopeTimelineRenderOptions extends ScopeTimelineSvgOptions {
  /** canvas-viewport 통합 */
  viewport?: boolean;
  /** 미니맵 표시 */
  minimap?: boolean;
  /** 행 클릭 콜백 */
  onRowClick?: (row: ScopeTimelineRow) => void;
  /** step 호버 콜백 */
  onStepHover?: (step: { rowId: string; stepIndex: number } | null) => void;
}

function renderScopeTimeline(
  host: HTMLElement,
  data: ScopeTimelineData,
  options?: ScopeTimelineRenderOptions,
): { destroy: () => void };
```

viz-web의 `GraphRenderer` 패턴. host에 SVG 마운트 + canvas-viewport 세션 + 이벤트 바인딩.

---

## viz-web 프리뷰 페이지

### 위치

`packages/viz-web/scope-nesting.html` + `packages/viz-web/src/scope-nesting-preview.ts`

### 구성

| 영역 | 내용 |
|---|---|
| 왼쪽 패널 | ScopeNesting 에디터 (JSON) |
| 중앙 | 통합 타임라인 (scope + contract + pipe + delegation) |
| 하단 | 요약 카드 (L1 구조, L1.5 마운트, L2 전이, L3 시뮬, Timing) |
| HUD | 줌/팬/피트뷰 (canvas-viewport) |

### 데이터 소스

1. **하드코드 예제**: canonical-review, incident-escalation
2. **JSON 입력**: 사용자가 ScopeNesting + PipeGraph를 직접 입력
3. **런타임 연결**: (향후) registry-service에서 서비스 scope 정보 fetch

---

## 구현 순서

| 단계 | 파일 | 내용 |
|---|---|---|
| 1 | `core/src/scope-nesting-timeline.ts` | ScopeTimelineData → ScopeTimelineRow[] 변환 + scopeTimelineToSvg |
| 2 | `core/src/scope-nesting-timeline.ts` | scopeTimelineToD3 |
| 3 | `core/src/scope-nesting-timeline.test.ts` | SVG 출력 + D3 데이터 구조 검증 |
| 4 | `viz-web/src/scope-nesting-preview.ts` | renderScopeTimeline + canvas-viewport 통합 |
| 5 | `viz-web/scope-nesting.html` | 프리뷰 페이지 HTML |
| 6 | `scope-nesting-demo.html` 제거 | viz-web 프리뷰로 대체 |

### 의존성

```
단계 1, 2 → 3 (테스트)
단계 1, 2, 3 → 4 (프리뷰)
단계 4 → 5 (HTML)
```

---

## 관련 소스

| 재사용 대상 | 경로 | 사용 방법 |
|---|---|---|
| SVG primitives | `core/src/pipe/pipe-svg-primitives.ts` | svgRect, svgText, svgLine 직접 호출 |
| 디자인 토큰 | `core/src/pipe/pipe-svg-shapes.ts` | ROLE_TOKENS, EDGE_TOKENS 색상 참조 |
| Standalone SVG | `core/src/pipe/pipe-svg-shapes.ts` | standaloneNodeSvg 패턴 참고 |
| 캔버스 추상화 | `canvas-viewport/src/` | createCanvasViewportSession + HUD |
| viz-web 프리뷰 | `viz-web/src/pipe-preview.ts` | 탭 전환 + 줌 레벨 패턴 참고 |
| registry-ui D3 | `registry-ui/src/pages/file-map/render-canvas.ts` | D3 + canvas-viewport 통합 패턴 |
