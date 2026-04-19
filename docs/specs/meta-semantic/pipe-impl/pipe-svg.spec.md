---
def:
  id: pipe-svg
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: mediation
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-zoom
      type: depends_on
    - target: pipe-flow-catalog
      type: depends_on
  source: packages/viz-core/src/pipe-svg.ts
---

# PipeGraph → SVG / D3 렌더링

## 목적 ^purpose

PipeGraph 또는 ZoomView를 SVG 문자열 또는 D3 데이터(노드+링크)로 변환한다.
3-레이어 아키텍처로 구성되어 각 레이어를 독립적으로 재사용할 수 있다.

## 3-레이어 아키텍처 ^defines

```
pipe-svg-primitives.ts   — SVG 요소 빌더 (도메인 무관)
pipe-svg-shapes.ts       — 도메인 도형 + 디자인 토큰 (role/concern/edge)
pipe-svg.ts              — 그래프 수준 렌더러 (PipeGraph → SVG/D3)
```

### Layer 1 — SVG 프리미티브 (`pipe-svg-primitives.ts`)

SVG 요소를 문자열로 생성하는 순수 함수들. 도메인 지식 없음.

| 함수 | 역할 |
|------|------|
| `svgRect(x, y, w, h, attrs)` | `<rect>` 요소 |
| `svgCircle(cx, cy, r, attrs)` | `<circle>` 요소 |
| `svgPolygon(points, attrs)` | `<polygon>` 요소 |
| `svgLine(x1, y1, x2, y2, attrs)` | `<line>` 요소 |
| `svgPath(d, attrs)` | `<path>` 요소 |
| `svgText(x, y, text, attrs)` | `<text>` 요소 |
| `svgGroup(children, attrs)` | `<g>` 그룹 |
| `svgSvg(w, h, children, attrs)` | 루트 `<svg>` |
| `svgMarker(id, w, h, refX, refY, children)` | `<marker>` 정의 |
| `svgDefs(children)` | `<defs>` 블록 |
| `bezierH(x1, y1, x2, y2)` | 수평 3차 베지어 `d` 문자열 |
| `arcAbove(x1, y1, x2, y2, lift)` | U자형 호 `d` 문자열 |
| `r(n)` | 소수 2자리 반올림 |
| `escapeXml(s)` | XML 특수문자 이스케이프 |
| `escapeAttr(s)` | 속성값 이스케이프 |

### Layer 2 — 도형 + 토큰 (`pipe-svg-shapes.ts`)

PipeRole / PipeConcern / ConnectionKind를 시각 토큰으로 매핑.

**디자인 토큰**

| 토큰 | 타입 | 내용 |
|------|------|------|
| `ROLE_TOKENS` | `Record<PipeRole, {fill, stroke}>` | role별 배경/테두리 색상 |
| `CONCERN_TOKENS` | `Record<PipeConcern, {bg, label}>` | concern 배지 색상+라벨 |
| `EDGE_TOKENS` | `Record<ConnectionKind, EdgeTokens>` | 선 색상/두께/점선/마커 |
| `CERTAINTY_STROKE_DASH` | `Record<certainty, string?>` | certainty별 strokeDasharray |

**노드 도형 (role별)**

| role | 모양 | 특이사항 |
|------|------|---------|
| producer | 오른쪽 뾰족 오각형 | 화살표 방향 표시 |
| consumer | 둥근 직사각형 (stadium) | 기본형 |
| transformer | 다이아몬드 컷 육각형 | 입출력 흐름 표시 |
| router | 마름모 (diamond) | 분기 시각화 |
| observer | 타원 (ellipse) | 비침투 강조 |

**독립 렌더링 함수**

- `standaloneNodeSvg(opts)` — PipeGraph 없이 단일 노드 SVG 생성 (design catalog용)
- `standaloneEdgeSvg(opts)` — 단일 엣지 SVG 생성 (edge 갤러리용)
- `renderMarkerDefs()` — 화살촉 8종 마커 `<defs>` 블록
- `drawNodeShape(x, y, w, h, opts)` — role + certainty 반영 노드 본체
- `drawFoldedNode(x, y, w, h, opts)` — 접힌 노드 (이중 테두리)
- `drawEntryMarker(x, y, h)` — 진입점 ▶ 마커
- `drawConcernBadges(x, y, h, concerns)` — 관심사 원형 배지 (최대 4개)
- `drawNodeLabel(x, y, w, h, label)` — 노드 라벨 텍스트
- `drawEdgePath(x1, y1, x2, y2, kind, opts)` — ConnectionKind별 엣지 경로
- `drawConditionBadge(mx, my, condition)` — conditional 엣지 조건 라벨

### Layer 3 — 그래프 렌더러 (`pipe-svg.ts`)

PipeGraph → ZoomView → 노드 배치 → SVG/D3 직렬화.

| 함수 | 입력 | 출력 |
|------|------|------|
| `pipeGraphToSvg(graph, level?, opts?)` | PipeGraph | SVG 문자열 |
| `zoomViewToSvg(view, opts?)` | ZoomView | SVG 문자열 |
| `pipeGraphToD3(graph, level?)` | PipeGraph | D3GraphData |
| `zoomViewToD3(view)` | ZoomView | D3GraphData |

**렌더링 파이프라인**

```
PipeGraph
  → computeZoomView(graph, level)   ← ZoomView (줌 레벨 적용)
  → computeLayout(view)             ← ZoomNode[] (x, y 좌표 배치)
  → renderMarkerDefs()              ← <defs> 화살촉 8종
  → drawNodeShape / drawNodeLabel   ← 노드 SVG
  → drawEdgePath / drawConditionBadge ← 엣지 SVG
  → svgSvg(width, height, children) ← 최종 <svg>
```

**D3 데이터 구조**

```typescript
D3GraphData {
  nodes: D3Node[]   // { id, label, role, concerns, x, y, w, h }
  links: D3Link[]   // { source, target, kind, condition? }
}
```

## 소비 ^consumes

- `ZoomView`, `ZoomNode`, `ZoomEdge`, `computeZoomView`, `computeLayout` (pipe-zoom.ts)
- `classifyPipeRole`, `extractPipeConcerns` (pipe-interpret.ts)
- `drawNodeShape`, `drawEdgePath`, `renderMarkerDefs` (pipe-svg-shapes.ts)
- SVG 프리미티브 (pipe-svg-primitives.ts)

## EdgeToken 세부 (8종)

| kind | stroke | 두께 | 점선 | 마커 |
|------|--------|------|------|------|
| next | #546e7a | 2 | 실선 | 화살촉 |
| conditional | #1976d2 | 2 | 8 4 | 조건 화살촉 |
| event | #6a1b9a | 3 | 실선 | 이벤트 화살촉 |
| error | #c62828 | 2.5 | 4 3 | 에러 화살촉 |
| compensate | #ad1457 | 2.5 | 3 3 | 양방향 마커 |
| fan-out | #0288d1 | 2 | 실선 | 팬아웃 화살촉 |
| join | #2e7d32 | 2 | 실선 | 조인 화살촉 |
| feedback | #e65100 | 1.5 | 6 3 | 피드백 화살촉 |

> 화살촉 z-order: `refX = markerWidth`로 설정하여 tip이 path 끝점과 정확히 일치. 노드 배경 뒤로 숨지 않음.

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/pipe/pipe-svg-primitives.ts` | Layer 1 — SVG 프리미티브 |
| `core/src/pipe/pipe-svg-shapes.ts` | Layer 2 — 도형 + 토큰 |
| `core/src/pipe/pipe-svg.ts` | Layer 3 — 그래프 렌더러 |
| `core/src/pipe/pipe-svg.test.ts` | 테스트 (15 tests) |
| `viz-web/src/pipe-preview.ts` | 미리보기 페이지 |
| `viz-web/src/pipe-design.ts` | 디자인 카탈로그 (29종 × role/concern) |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-svg.test.ts
```
