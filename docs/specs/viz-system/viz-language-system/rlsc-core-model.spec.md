---
def:
  tier: component
  id: rlsc-core-model
  address: def_document:v2:342192
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: platform-demo
  tags: [data, structural, runtime]
  links:
    - target: viz-language-system
      type: refines
sources:
  - packages/rlsc-analysis/src/index.ts
  - packages/rlsc-analysis/src/browser.ts
  - packages/rlsc-analysis/src/browser.test.ts
---

# RLSC 핵심 모델

## 목적 ^purpose

RLSC의 정체성, 핵심 개념, 마크업 포맷을 분리해 시각 구조 DSL이 무엇을 표현하는지 명확히 한다.

## 구성 ^overview

R.L.S.C.™ (Relative Layout Structured Content)는 디자인의 시각적 구조를 좌표계 데이터로 표현한다. 현재 qa-sdk가 검증하는 구현은 공개 `rlsc-analysis` submodule의 browser collector/metadata 분석이며, DOM을 순회하여 구조·텍스트·위치·스타일 신호를 분석 fact로 정규화한다. 전체 DSL 인코더와 Inspector UI는 `pnpm-mcp`의 외부 패키지 경계에 있다.

## 핵심 타입

### RLSCNode — 마크업 기본 단위

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | `tag#id` 또는 자동 생성 (`tag-N`) |
| `tag` | string | HTML 태그명 |
| `classes` | string[] | CSS 클래스 |
| `role` | string? | ARIA role 또는 시맨틱 추론 |
| `rect` | LayoutRect | 뷰포트 기준 위치/크기 (x, y, width, height) |
| `zIndex` | number | z-index 값 |
| `depth` | number | DOM 깊이 (root=0) |
| `display` | string | CSS display |
| `position` | string | CSS position |
| `overflow` | string | CSS overflow |
| `visible` | boolean | 뷰포트 내 가시 여부 |
| `textContent` | string? | 가시 텍스트 (최대 80자) |
| `address` | string? | 기존 좌표계 주소 (`data-qa-address`) |
| `debugLabel` | string? | 디버깅용 라벨 (`data-debug-label`) |
| `boundary` | string? | 경계 태그 (`data-boundary`) |
| `fontInfo` | TextFontInfo? | 텍스트 점유 추정에 사용하는 글꼴/패딩 |
| `styleStack` | StandardStyleStack? | 레이아웃에 필요한 축약 스타일 |
| `identifier` | ScreenIdentifier? | component/qa/css/node 재식별 정보 |
| `attributes` | Record | data-*, aria-*, href, src, alt 등 의미론적 속성 |
| `children` | RLSCNode[] | 자식 노드 |

### LayoutGrid — 뷰포트 셀 분할 행렬

- `cellSize`: 셀 크기 (기본 32px)
- `cells[row][col]`: 각 셀의 `nodeIds`, `zStack`, `dominant`, `coverage`
- `analyzeGrid(root, viewport)` 로 생성

### LayerStack — z-index 레이어 분류

| z-index 범위 | 역할 |
|--------------|------|
| < 0 | background |
| 0 | background |
| 1 ~ 9 | content |
| 10 ~ 99 | sticky |
| 100 ~ 999 | overlay |
| 1000 ~ 9999 | modal |
| >= 10000 | tooltip |

### RLSCRelation — 노드 간 공간 관계

현재 `detectRelations()`가 생성하는 관계는 `contains`, `overlaps`, `aligned-x`, `aligned-y` 네 종류다. 타입 유니온에는 향후 확장을 위해 `adjacent-x`, `adjacent-y`, `stacked`, `flow`도 남아 있지만 현재 collector가 이를 생성한다고 가정하면 안 된다.

- `contains`: 한 rect가 다른 rect를 완전히 포함
- `overlaps`: 두 rect가 교차 (`strength: 0.5`)
- `aligned-x` / `aligned-y`: 해당 축 좌표가 4px 이내로 정렬
- `strength: 1`은 `contains`에만 사용된다.

### RLSCDocument — 전체 문서

```typescript
interface RLSCDocument {
  version: "1.0";
  viewport: { width, height };
  url: string;
  timestamp: string;
  address?: string;        // 문서 단위 좌표계 주소
  root: RLSCNode;          // 루트 노드 트리
  grid: LayoutGrid;        // 그리드 분석 결과
  layers: LayerStack[];    // z-index 레이어 스택
  relations: RLSCRelation[]; // 공간 관계
}
```

## 직렬화와 Inspector 경계

`rlsc-analysis`의 현재 공개 export에는 `encodeToMarkup`/`parseMarkup`가 없다. 이 API와 RLSC/1.0 텍스트 포맷, Inspector UI가 필요한 소비자는 [pnpm-mcp의 rlsc 패키지](https://github.com/mineclover/pnpm-mcp/tree/main/packages/rlsc)와 [rlsc-demo](https://github.com/mineclover/pnpm-mcp/tree/main/packages/rlsc-demo)를 사용한다. qa-sdk 문서는 그 외부 구현을 현재 submodule의 API로 혼동하지 않는다.

## 수집 옵션 — CollectorOptions

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `minSize` | 4px | 최소 크기 필터 |
| `maxDepth` | 20 | 최대 DOM 깊이 |
| `includeHidden` | false | 숨겨진 요소 포함 여부 |
| `maxTextLength` | 80 | 텍스트 truncate 길이 |
| `addressAttribute` | `"data-qa-address"` | 좌표계 주소 추출 속성 |
