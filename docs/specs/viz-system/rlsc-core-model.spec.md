---
def:
  id: rlsc-core-model
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: rlsc-spec
      type: refines
---

# RLSC 핵심 모델

## 목적 ^purpose

RLSC의 정체성, 핵심 개념, 마크업 포맷을 분리해 시각 구조 DSL이 무엇을 표현하는지 명확히 한다.

## 구성 ^overview

R.L.S.C.™ (Relative Layout Structured Content)는 디자인의 시각적 구조를 좌표계 DSL로 표현한다. DOM을 순회하여 노드 트리(R), 그리드 행렬(L), z-index 레이어 스택(S), 공간 관계(C)를 추출하고, 마크업 문자열로 직렬화하여 LLM Context Engineering에 사용한다.

## 핵심 타입

### RLSCNode — 마크업 기본 단위

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | `tag#id` 또는 자동 생성 (`tag.class__N`) |
| `tag` | string | HTML 태그명 |
| `classes` | string[] | CSS 클래스 |
| `role` | string? | ARIA role 또는 시맨틱 추론 |
| `rect` | LayoutRect | 뷰포트 기준 위치/크기 (x, y, width, height) |
| `zIndex` | number | z-index 값 |
| `depth` | number | DOM 깊이 (root=0) |
| `display` | string | CSS display |
| `position` | string | CSS position |
| `visible` | boolean | 뷰포트 내 가시 여부 |
| `textContent` | string? | 가시 텍스트 (최대 80자) |
| `address` | string? | 기존 좌표계 주소 (`data-qa-address`) |
| `attributes` | Record | data-*, aria-*, href, src, alt 등 의미론적 속성 |
| `children` | RLSCNode[] | 자식 노드 |

### LayoutGrid — 뷰포트 셀 분할 행렬

- `cellSize`: 셀 크기 (기본 16px)
- `cells[row][col]`: 각 셀의 `nodeIds`, `zStack`, `dominant`, `coverage`
- `analyzeGrid(root, viewport)` 로 생성

### LayerStack — z-index 레이어 분류

| z-index 범위 | 역할 |
|--------------|------|
| < 0 | background |
| 0 ~ 9 | content |
| 10 ~ 99 | sticky |
| 100 ~ 999 | overlay |
| 1000 ~ 9999 | modal |
| >= 10000 | tooltip |

### RLSCRelation — 노드 간 공간 관계

8가지 관계 유형: `contains`, `overlaps`, `adjacent-x`, `adjacent-y`, `aligned-x`, `aligned-y`, `stacked`, `flow`

- `contains`: DOM depth 기반 포함 관계 (외부 rect가 내부 rect를 완전 포함)
- `stacked`: 같은 위치, 다른 z-index (overlap > 0.8)
- `overlaps`: rect 겹침 (overlap > 0.1)
- `adjacent-x/y`: 16px 이내 인접
- `aligned-x/y`: 4px 이내 정렬
- `flow`: 같은 부모 아래 형제 노드 순서

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

## 마크업 포맷

`encodeToMarkup(doc)` 로 직렬화:

```
RLSC/1.0
viewport: 1920x1080
url: https://example.com
timestamp: 2026-03-26T...
---
# Tree
[header#main-header] @(0,0) 1920x60 role:banner
  [nav.main-nav] @(100,10) 800x40 display:flex role:navigation
---
# GRID 16px cols:120 rows:68
  (0..119,0..3): header#main-header
---
# Layers
  z:    0  content      [header#main-header, nav.main-nav]
---
# Relations
  header#main-header CONTAINS nav.main-nav
```

## 수집 옵션 — CollectorOptions

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `minSize` | 4px | 최소 크기 필터 |
| `maxDepth` | 20 | 최대 DOM 깊이 |
| `includeHidden` | false | 숨겨진 요소 포함 여부 |
| `maxTextLength` | 80 | 텍스트 truncate 길이 |
| `addressAttribute` | `"data-qa-address"` | 좌표계 주소 추출 속성 |
