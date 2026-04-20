---
def:
  id: rlsc-collector
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
---

## 목적 ^purpose

DOM 트리를 순회하여 RLSCNode 트리를 생성한다. 브라우저 전용.
루트 요소에서 시작하여 자식 노드를 재귀 수집하고, 그리드/레이어/관계 분석을 통합하여
RLSCDocument를 반환한다.

## ^defines

- `packages/rlsc/src/collector.ts:collectLayout` — 공개 진입점. `(root?, options?) → RLSCDocument`
  - root 미지정 시 `document.body` 사용
  - viewport: `window.innerWidth / innerHeight`
  - 수집 후 `flattenTree` → `analyzeGrid` + `classifyLayers` + `detectRelations` 통합

- `packages/rlsc/src/collector.ts:CollectorOptions` — 수집 동작 제어 옵션 (types.ts 정의)
  - `minSize`: 최소 크기 필터 (기본 4px). 가로/세로 모두 미만이면 수집 제외
  - `maxDepth`: 최대 트리 깊이 (기본 20)
  - `includeHidden`: 비가시 노드 포함 여부 (기본 false)
  - `maxTextLength`: 직접 텍스트 최대 길이 (기본 80, 초과 시 `…` 말줄임)
  - `addressAttribute`: 주소 속성명 (기본 `"data-qa-address"`)

- `packages/rlsc/src/collector.ts:SKIP_TAGS` — 수집 제외 태그 집합
  - script / style / noscript / link / meta / head / br / wbr

- `packages/rlsc/src/collector.ts:inferRole` — 시맨틱 태그 → ARIA role 자동 추론 (내부)
  - 18개 매핑: header→banner, footer→contentinfo, main, nav→navigation, aside→complementary,
    section→region, article, form, button, a→link, img, input→textbox, select→combobox,
    textarea→textbox, ul/ol→list, li→listitem, table, dialog
  - 매핑 없으면 null 반환

- `packages/rlsc/src/collector.ts:getSemanticAttributes` — 의미론적 속성 추출 (내부)
  - data-*, aria-*, href, src, alt, type, name 추출

## ^consumes

- `packages/rlsc/src/types.ts` — RLSCNode, RLSCDocument, CollectorOptions, LayoutRect
- `packages/rlsc/src/tree-utils.ts` — flattenTree
- `packages/rlsc/src/grid.ts` — analyzeGrid
- `packages/rlsc/src/relations.ts` — detectRelations
- `packages/rlsc/src/layers.ts` — classifyLayers

> 제약: `window` / `document` / `getComputedStyle` / `getBoundingClientRect` 직접 사용 — 브라우저 전용.
> `collectLayout()` 진입부에서 `typeof window === "undefined"` 체크 — 서버/Node 환경에서 즉시 오류 발생.
