---
def:
  id: rlsc-spec
  address: def_document:v1:1
  scope: ui
  aspect: layout
  depth: specification
  lifecycle: deprecated
  layer: experience
  tags: [tier-infra]
  links:
    - target: motion-content-glossary
      type: depends_on
---

# R.L.S.C.™ — Relative Layout Structured Content

## 목적 ^purpose

디자인의 시각적 구조(레이아웃, 계층, Role)를 좌표계 DSL로 표현하고, 검색·대치·생성이 가능한 마크업 언어

## 1. 정체성

R.L.S.C.는 **웹/앱의 물리적 레이아웃을 의미론적 좌표와 결합하여 구조화된 문서로 수집하는 시스템**이다.

| 기존 좌표계 (QA-SDK) | R.L.S.C. |
|---|---|
| 의미론적 위치 (svc × page × action) | 물리적 위치 (x, y, z-index, width, height) |
| SemanticAddress → 1D integer | LayoutRect → 2D/3D grid cell |
| "이 이벤트가 어디서 왔는가" | "이 요소가 화면 어디에 있는가" |

**결합**: `RLSCNode = SemanticAddress + LayoutRect + Role`

## 2. 핵심 개념

### 2.1 RLSCNode — 마크업의 기본 단위

```
[tag#id.class] @(x,y) width×height z:depth role:semantic "text"
  [child] @(cx,cy) cw×ch z:cz role:child-role
```

- **tag**: HTML 요소 (`div`, `nav`, `section`, ...)
- **rect**: viewport 기준 위치와 크기 `@(x,y) w×h`
- **z**: z-index (레이어 깊이)
- **role**: ARIA role 또는 의미론적 역할
- **text**: 가시 텍스트 (축약)
- **children**: 중첩 노드

### 2.2 LayoutGrid — 행렬 표현

뷰포트를 고정 크기 셀로 분할하여 어떤 노드가 어떤 셀을 점유하는지 행렬로 표현.

```
GRID 120px  cols:16  rows:9
  (0,0)-(15,0): header     ████████████████
  (0,1)-(15,3): hero       ████████████████
  (0,4)-(3,7):  card[0]    ████
  (4,4)-(7,7):  card[1]        ████
  (8,4)-(11,7): card[2]            ████
```

### 2.3 LayerStack — z-index 레이어

z-index 기반으로 노드를 레이어로 그룹화:

| 레이어 | z 범위 | 역할 |
|--------|--------|------|
| background | < 0 | 배경 |
| content | 0–9 | 주 콘텐츠 |
| sticky | 10–99 | 고정 요소 (header, sidebar) |
| overlay | 100–999 | 오버레이 (dropdown, modal backdrop) |
| modal | 1000–9999 | 모달 다이얼로그 |
| tooltip | ≥ 10000 | 툴팁, toast |

### 2.4 RLSCRelation — 공간 관계

| 관계 | 의미 | 탐지 조건 |
|------|------|----------|
| `contains` | 부모-자식 | DOM 계층 |
| `overlaps` | 영역 겹침 | rect 교차 |
| `adjacent-x` | 수평 인접 | gap < threshold, y 겹침 |
| `adjacent-y` | 수직 인접 | gap < threshold, x 겹침 |
| `aligned-x` | x 정렬 | 같은 x 또는 같은 width |
| `aligned-y` | y 정렬 | 같은 y 또는 같은 height |
| `stacked` | z 겹침 | 같은 rect, 다른 z |
| `flow` | 흐름 연결 | 순차적 형제 |

## 3. 마크업 포맷

```
RLSC/1.0
viewport: {width}×{height}
url: {page-url}
timestamp: {ISO-8601}
address: {semantic-address}       # 기존 좌표계 주소 (선택)
---
# Tree
{indented RLSCNode tree}
---
# Grid {cellSize}px
{grid occupation matrix}
---
# Layers
{z-index layer stacks}
---
# Relations
{spatial relationships}
```

### 3.1 마크업 예시

```
RLSC/1.0
viewport: 1440×900
url: https://shop.example.com/products
timestamp: 2026-03-24T10:30:00Z
address: page_view:v2:5
---
# Tree
[header#site-header] @(0,0) 1440×56 z:100 role:banner
  [nav] @(0,0) 1440×56 z:100 role:navigation display:flex
    [a.logo] @(24,8) 120×40 z:101 "ShopName"
    [ul.menu] @(200,0) 600×56 z:100 role:list
      [li] @(200,12) 80×32 role:listitem [a "Home"]
      [li] @(296,12) 100×32 role:listitem [a "Products"]
    [div.actions] @(1220,8) 200×40 z:100
      [button] @(1220,8) 80×40 z:101 role:button "Cart"
[main] @(0,56) 1440×844 z:1 role:main
  [section.hero] @(0,56) 1440×360 z:1 role:region
    [h1] @(120,180) 500×48 z:2 "Spring Collection"
  [section.grid] @(0,416) 1440×428 z:1 role:region display:grid
    [article.card] @(40,436) 320×380 z:1 role:article
      [img] @(40,436) 320×240 z:1
      [h3] @(56,692) 288×24 z:1 "Product A"
      [span.price] @(56,724) 80×20 z:1 "$29.99"
    [article.card] @(380,436) 320×380 z:1 role:article
      [img] @(380,436) 320×240 z:1
      [h3] @(396,692) 288×24 z:1 "Product B"
---
# Grid 120px cols:12 rows:8
  (0,0)-(11,0):  header#site-header
  (0,1)-(11,3):  section.hero
  (0,4)-(2,7):   article.card[0]
  (3,4)-(5,7):   article.card[1]
---
# Layers
  z:1    content   [main, section.hero, section.grid, article.card×2]
  z:100  sticky    [header#site-header, nav, ul.menu]
  z:101  controls  [a.logo, button]
---
# Relations
  header CONTAINS nav
  nav CONTAINS logo, menu, actions
  section.hero ADJACENT-Y section.grid
  card[0] ALIGNED-X card[1]
  card[0] FLOW card[1]
```

## 4. Context Engineering

R.L.S.C. 문서를 LLM이 이해할 수 있는 컨텍스트로 변환하는 파이프라인.

### 4.1 Schema

```typescript
interface ContextSchema {
  nodeTypes: NodeTypeDefinition[];     // 노드 유형 정의
  relationTypes: RelationTypeDef[];    // 관계 유형 정의
  constraints: LayoutConstraint[];     // 레이아웃 제약 조건
}
```

### 4.2 Prompt Template

| 목적 | 템플릿 | 포함 정보 |
|------|--------|----------|
| layout-analysis | 레이아웃 분석 | 구조 요약 + 그리드 + 관계 |
| component-search | 컴포넌트 검색 | 쿼리 + 매칭 노드 |
| design-generation | 디자인 생성 | 현재 구조 + 요구사항 |
| design-diff | 변경 비교 | before/after 차이 |

### 4.3 Schema Manipulation Tools

| 도구 | 입력 | 출력 |
|------|------|------|
| `query` | selector + document | 매칭 노드 목록 |
| `replace` | nodeId + patch | 수정된 문서 |
| `generate` | constraints + template | 새 R.L.S.C. 마크업 |
| `diff` | doc1 + doc2 | 변경 목록 |
| `validate` | document + schema | 검증 결과 |

### 4.4 모니터링

- **Snapshot 주기**: requestAnimationFrame 또는 MutationObserver
- **Diff 감지**: rect 변경, z-index 변경, 노드 추가/삭제
- **Drift 분석**: 시간에 따른 레이아웃 변화 패턴

## 5. 기존 좌표계 통합

### 5.1 SemanticAddress 연결

```
page_view:v2:5  ←→  RLSC document (viewport snapshot)
tracking:v3:12  ←→  RLSCNode (interaction target)
flow_point:v2:8 ←→  RLSCRelation (flow connection)
```

### 5.2 AddressProtocol 확장

```
layout:{prefix}:{version}:{grid-cell}
layout:page_view:v2:5@(3,2)       # page_view 주소 + 그리드 위치
```

### 5.3 BrowserCodec 통합

browser-codec의 `track()` 호출 시 현재 target element의 LayoutRect를 자동 첨부:

```typescript
trackWithLayout(catalog, prefixDims, targetElement) → {
  address: "tracking:v3:12",
  layout: { x: 380, y: 436, width: 320, height: 380, z: 1 }
}
```

## 6. API 요약

```typescript
// 수집
collectLayout(root?: Element, options?): RLSCDocument

// 인코딩
encodeToMarkup(doc: RLSCDocument): string
parseMarkup(markup: string): RLSCDocument

// 분석
analyzeGrid(root: RLSCNode, viewport, cellSize?): LayoutGrid
detectRelations(nodes: RLSCNode[]): RLSCRelation[]
classifyLayers(nodes: RLSCNode[]): LayerStack[]

// Context Engineering
generateDesignContext(doc: RLSCDocument, options?): DesignContext

// 쿼리
queryNodes(doc: RLSCDocument, query: RLSCQuery): RLSCNode[]
findByRect(doc: RLSCDocument, rect: LayoutRect): RLSCNode[]
findByRole(doc: RLSCDocument, role: string): RLSCNode[]

// 모니터링
createLayoutMonitor(root: Element, onChange: Callback): LayoutMonitor
```

## 7. 패키지 구조

```
packages/rlsc/
  src/
    types.ts        — 핵심 타입 정의
    collector.ts    — DOM → RLSCDocument
    encoder.ts      — 마크업 직렬화/역직렬화
    grid.ts         — 그리드 분석
    relations.ts    — 공간 관계 탐지
    context.ts      — Context Engineering
    query.ts        — 검색/필터 API
    index.ts        — public exports
```
