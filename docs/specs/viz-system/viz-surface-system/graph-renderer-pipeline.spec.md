---
def:
  tier: component
  id: graph-renderer-pipeline
  address: def_document:v2:1155
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [frontend, observability, runtime]
  links:
    - target: viz-surface-system
      type: refines
sources:
  - packages/viz-web/src/main.ts
  - packages/viz-web/src/graph/layout.ts
  - packages/viz-web/src/graph/renderer.ts
  - packages/viz-web/src/graph/style.ts
  - packages/viz-web/src/graph/updater.ts
  - packages/viz-3d/src/core/grid-builder.ts
  - packages/viz-3d/src/renderer/scene-builder.ts
---

# 그래프 렌더러 파이프라인

## 목적 ^purpose

`SpecGraph`를 DAG 레이아웃으로 배치하고 SVG로 렌더링하는 그래프 렌더러의 핵심 파이프라인을 정리한다.

## 구성 ^overview

viz-web은 `ScenarioSpec`을 `compileSpec()`으로 `SpecGraph`로 변환하고, `computeLayout()` + `createGraphSvg()`로 SVG/canvas viewport 기반 그래프를 렌더링한다. 별도로 viz-3d 패키지가 좌표/시그널을 Three.js 3D 그리드로 시각화한다.

## 렌더링 파이프라인

```
ingest/session API
  │
  ├── listScenarios() → scenario selector
  │
  └── selected ScenarioSpec
        │
        ├── compileSpec() → SpecGraph
        │     ├── nodes: step_id/event_key/role/required
        │     └── edges: source/target/type
        │
        └── computeLayout() + createGraphSvg()
              └── SVG scene + minimap/HUD/support bar
```

## 사이드바 — scenario/session 선택기

- scenario selector가 scenario 목록을 로드하고 선택 시 graph/session 상태를 초기화한다.
- session list는 기존 session과 새 session을 표시하고 선택 시 historical record + WS buffer를 merge/replay한다.
- verdict panel은 recompute API 결과를 step match/missing/unexpected/latency 정보로 표시한다.

## SVG 렌더링

- dagre 기반 layout 결과를 SVG `g/path/rect/text`로 렌더링한다.
- canvas-viewport HUD, minimap, support bar를 같은 shell에 조립한다.
- `GraphRole`과 `NodeState`를 CSS class로 변환해 상태/역할별 스타일을 적용한다.
- 이벤트 badge와 highlighted edge는 renderer API를 통해 부분 갱신한다.

## 3D 그리드 — viz-3d 파이프라인

```
BROWSER_CATALOG (prefix/axis 정의)
  │
  ├── 그리드 구성: prefix별 axis entries → 셀 행렬
  │     ├── 2D 그리드: entries × cols (기본)
  │     └── 3D 그리드: axes3d.x × axes3d.y × axes3d.z
  │
  ├── 뷰 레이아웃: layer/category/dsl/service 기준 배치
  │     └── viewPositions 계산 (카메라 위치 프리셋)
  │
  └── Three.js 렌더링
        ├── 셀 → InstancedMesh (카테고리별 색상)
        ├── 그리드 프레임 → LineSegments
        ├── 라벨 → CSS2DRenderer
        └── 활성 셀 → opacity/emissive 변경
```

## 스타일 매핑 원칙

- 스타일은 데이터 의미를 시각적 속성(색상, 선 굵기)으로 번역
- 레이아웃 알고리즘과 분리 — layout 결과를 무효화하지 않는 선에서 스타일 변경
- 카테고리 색상은 `viz-3d` theme/type 계층에서 중앙 관리
- 셀 opacity 변화는 레이아웃 재계산 없이 material만 갱신

## 네비게이션

- 카메라 프리셋: layer, category, dsl, service 뷰
- 마우스 드래그: 카메라 회전 (OrbitControls)
- 스크롤: 줌 인/아웃
- 셀 클릭: 해당 prefix/entry 상세 정보 표시
