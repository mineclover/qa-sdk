---
def:
  id: rlsc-canvas
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: mediation
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
    - target: rlsc-metrics
      type: depends_on
---

^purpose

RLSCDocument를 색상 매핑 이미지로 렌더링한다.
DOM 노드에 역할·레이어·깊이 기준 색상을 부여하고 z-index 순서대로 겹쳐 그려
레이아웃 구조, 레이어 겹침, 게슈탈트 그룹, 균형 축선을 한 장의 이미지로 표현한다.
브라우저(Canvas 2D)와 서버/테스트(SVG 문자열) 두 렌더 경로를 지원한다.

^defines

**타입**

- `CanvasRenderOptions` — 렌더 설정
  - `colorBy: "role" | "layer" | "depth" | "custom"` — 색상 기준 (기본: "role")
  - `palette?: Record<string, string>` — role/layer → CSS color 오버라이드
  - `opacity?: number` — 노드 fill 불투명도, 기본 0.6
  - `showGrid?: boolean` — 셀 격자 오버레이 (기본 false)
  - `showGroups?: boolean` — proximity group 경계 오버레이 (기본 false)
  - `showBalance?: boolean` — 균형 축선(뷰포트 중앙) 오버레이 (기본 false)
  - `showFlow?: boolean` — flow 방향 화살표 오버레이 (기본 false)
  - `metrics?: LayoutMetrics` — 오버레이에 사용할 측정값 (showGroups/showBalance/showFlow 활성 시 필요)

- `DEFAULT_ROLE_PALETTE` — role → 색상 기본 매핑
  - "banner": `#4A90D9`, "navigation": `#7B68EE`, "main": `#5CB85C`
  - "complementary": `#F0AD4E`, "contentinfo": `#D9534F`, "dialog": `#FF6B6B`
  - "form": `#20B2AA`, "search": `#9370DB`, 기타: `#999999`

- `DEFAULT_LAYER_PALETTE` — LayerRole → 색상 기본 매핑
  - "background": `#E8E8E8`, "content": `#5CB85C`, "sticky": `#F0AD4E`
  - "overlay": `#FF9933`, "modal": `#D9534F`, "tooltip": `#9370DB`

**함수**

- `packages/rlsc/src/canvas.ts:renderToCanvas` — `(doc, canvas: HTMLCanvasElement, options?) → void`
  - 브라우저 전용. `typeof canvas.getContext !== "function"` 시 에러
  - `canvas.width = viewport.width`, `canvas.height = viewport.height` 자동 설정
  - 노드를 zIndex 오름차순으로 정렬 후 fillRect 순서대로 그림
  - `assignColors(nodes, colorBy)` 결과로 fillStyle 결정
  - 오버레이 순서: grid → groups → balance → flow (선택적)

- `packages/rlsc/src/canvas.ts:renderToSVG` — `(doc, options?) → string`
  - DOM 없이 SVG 문자열 생성 (서버/테스트 환경 호환)
  - `<svg viewBox="0 0 {width} {height}">` + rect 요소 배열
  - 오버레이는 `<g class="overlay-*">` 그룹으로 분리

- `packages/rlsc/src/canvas.ts:assignColors` — `(nodes: RLSCNode[], colorBy, palette?) → Map<string, string>`
  - "role": `node.role ?? "none"` → palette 조회
  - "layer": node zIndex → LayerRole 구간 → palette 조회
  - "depth": `depth / maxDepth` → HSL 밝기 그라데이션 (hsl(200, 60%, {30+ratio*50}%))
  - "custom": palette 직접 사용 (node.id → color)

- `packages/rlsc/src/canvas.ts:overlayProximityGroups` — `(ctx, groups, viewport) → void` (내부)
  - 그룹 boundingRect 주위에 점선 사각형 + 그룹 번호 레이블

- `packages/rlsc/src/canvas.ts:overlayBalanceAxis` — `(ctx, viewport) → void` (내부)
  - 뷰포트 중앙 수직선 + 수평선 (반투명 점선)

- `packages/rlsc/src/canvas.ts:overlayFlowArrows` — `(ctx, relations, nodeMap) → void` (내부)
  - `flow` + `adjacent-x` + `adjacent-y` 관계를 화살표로 시각화

^consumes

- `packages/rlsc/src/types.ts` — RLSCDocument, RLSCNode, LayoutMetrics, ProximityGroup, LayerRole
- `packages/rlsc/src/tree-utils.ts` — flattenTree

## 구현 항목

- [x] `CanvasRenderOptions` 타입 — `types.ts`에 추가
- [x] `canvas.ts` 파일 생성 — `renderToCanvas`, `renderToSVG`, `assignColors` 구현
- [x] 오버레이 내부 함수 3종 구현 (`overlayProximityGroups`, `overlayBalanceAxis`, `overlayFlowArrows`)
- [x] `index.ts` — `renderToCanvas`, `renderToSVG`, `assignColors`, `CanvasRenderOptions` export 추가
- [ ] `canvas.test.ts` — `renderToSVG` 단위 테스트 (DOM 없이)
  - role 기준 색상 매핑 검증
  - SVG 출력에 노드 수만큼 rect 요소 존재
  - depth 기준 색상이 깊이에 따라 변화
