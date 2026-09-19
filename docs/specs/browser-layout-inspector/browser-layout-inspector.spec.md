---
def:
  id: browser-layout-inspector
  type: spec
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [browser, measurement, interface]
sources:
  - packages/browser-layout-inspector/src/index.ts
  - packages/browser-layout-inspector/src/css-influences.ts
  - packages/browser-layout-inspector/src/css-inspector.ts
  - packages/browser-layout-inspector/src/computed-style.ts
  - packages/browser-layout-inspector/src/metrics.ts
  - packages/browser-layout-inspector/src/measurement.ts
  - packages/browser-layout-inspector/test/inspector.test.ts
  - packages/browser-layout-inspector-extension/src/content.ts
  - packages/browser-layout-inspector-extension/src/page-tools.ts
  - packages/browser-layout-inspector-extension/src/page-overview.ts
  - packages/browser-layout-inspector-extension/src/protocol.ts
  - packages/browser-layout-inspector-extension/src/background.ts
  - packages/browser-layout-inspector-extension/src/css-output.ts
  - packages/browser-layout-inspector-extension/src/json-output.ts
  - packages/browser-layout-inspector-extension/src/popup.ts
  - packages/browser-layout-inspector-extension/public/popup.html
  - packages/browser-layout-inspector-extension/public/demo.html
  - packages/browser-layout-inspector-extension/scripts/demo-server.mjs
  - packages/browser-layout-inspector-extension/public/manifest.json
---

# Browser Layout Inspector

## 목적 ^purpose

브라우저 extension content script가 페이지에서 직접 선택한 DOM의 CSS source 후보, 최종 적용 style, CSS px geometry, 상대·절대 위치를 분리해 읽고, 두 요소 간 거리를 측정하며, 탭 안에서만 유효한 inline style을 안전하게 편집·원복한다.

## API ^overview

| API | 반환 책임 |
|---|---|
| `collectCssInfluences(element)` | 현재 활성 stylesheet에서 매칭된 selector별 declarations, inline style, 읽을 수 없는 stylesheet 진단 |
| `inspectCssDeclarations(element)` | author/inline 선언 후보와 property-name 순서의 최종 computed 선언을 별도 read model로 투영 |
| `extractComputedStyle(element, properties?)` | 브라우저가 최종 계산한 style value |
| `extractElementMetrics(element)` | viewport/document rect, client rect fragments, offset/client/scroll 값, DPR |
| `extractPosition(element, reference?)` | viewport/document absolute position과 reference/offset-parent 대비 signed gap |
| `observeElementMetrics(element, callback)` | 선택적 `ResizeObserver` 기반 재측정 |
| `inspectSelectorLayout(selector)` | extension message handler용 통합 snapshot |
| `PageToolController` | 페이지 click/hover 자동 선택, A→B overlay·모서리/실제 gap 치수선·라벨 복사/drag, 독립 작업 목록과 tab-local mutation ledger·복구 |
| `현재 작업 목록` | 일반 선택·비교 A·비교 B·Ruler box를 재포커스하거나 개별 해제하고, 요소별 selector 후보를 고르는 Side Panel 상태 |
| `PageToolController.applyStyle/removeStyle` | 선택 요소의 `element.style` 선언만 즉시 적용·삭제하고 기존 inline 선언을 복구 가능하게 기록 |
| `Ruler` | 페이지의 임의 두 viewport 점을 드래그해 폭·높이·대각선 거리 CSS px 측정 |
| `Ruler snap / guides` | 선택적으로 8px grid에 맞추고, 완료한 마지막 ruler의 양 끝을 자동 viewport-fixed guide로 유지·교체·해제 |
| `browser-layout-inspector/measurement` | DOM·extension·테스트 framework 비의존 비교·Ruler·guide·CSS px tolerance 측정 API |
| `measureElementComparison(rectA, rectB)` | signed 대응 모서리/방향 edge 값과 실제 positive gap만 투영 |
| `measureRuler(start, end)` / `rulerGuides(ruler)` | 자유 Ruler 결과와 한 Ruler가 소유하는 4 edge guide 좌표를 투영 |
| `matchCssPixels(actual, expectation)` | framework-neutral CSS px tolerance 판정 read model을 반환 |
| `collectPageDomTree(document)` | 제한된 깊이·노드 수의 body DOM 계층과 선택 가능한 selector를 투영 |
| `extractPageStyles(document)` | 접근 가능한 author stylesheet 전체 CSS와 접근 불가 CSSOM 진단을 투영 |
| `Side Panel workspace` | 측정·선택, CSS Inspector, 화면 계층 구조, 페이지 스타일·내보내기 네 독립 UI 패널 |
| `Viewport PNG` | action으로 획득한 `activeTab` 권한으로 현재 보이는 페이지와 overlay를 PNG로 저장 |
| `formatInspectionAsCss(inspection)` | 최종 computed CSS와 label된 matched source 후보를 복사 가능한 CSS 텍스트로 투영 |
| `createLayoutExchange(state)` / `formatLayoutExchangeJson(state)` | `browser-layout-inspector.exchange.v1` JSON 데이터 교환 artifact를 생성 |
| `pnpm --filter browser-layout-inspector-extension demo` | 로컬 `127.0.0.1:4173`에서 CSS Inspector·A→B·Ruler 검사용 fixture 페이지를 제공 |
| MV3 Side Panel | action click으로 지속되는 현재 탭 도구 surface와 content state 자동 갱신 |

## 경계 ^constraint

- 모든 geometry는 CSS px다. `devicePixelRatio`는 관측값으로만 반환하며 변환하지 않는다.
- `matchedSelectors`는 현재 상태에서 DOM selector가 매칭된 CSS source 후보이며, 표준 CSSOM은 property별 cascade winner provenance를 제공하지 않는다. 최종 값은 반드시 `computedStyle`에서 읽는다.
- cross-origin stylesheet의 `cssRules`가 브라우저에 의해 차단되면 `inaccessibleStylesheets`에 기록한다. 권한 확장이나 우회로 읽지 않는다.
- MV3 shell은 `activeTab`, `scripting`, `sidePanel`, `<all_urls>` host permission을 사용한다. Side Panel에서 모든 일반 웹 페이지를 검사할 수 있도록 content script를 주입한다. `chrome://`, 확장 프로그램 페이지, Chrome Web Store 등 브라우저가 보호하는 페이지에는 Chrome 정책상 주입할 수 없다.
- 선택·측정 overlay는 `pointer-events: none`이며 picker가 활성화된 동안에만 page click을 capture한다. 일반 선택, 비교 A/B, Ruler는 서로 독립된 tab-local 작업 항목으로 남고 Side Panel에서 다시 CSS Inspector 대상으로 포커스하거나 해제할 수 있다. 각 요소 작업 항목은 매칭 CSS+고유 selector, 고유 `id`/지원 data selector, 비고유 매칭 CSS, 구조 fallback 순으로 후보를 제공한다. 선택 후보는 표시·복사·비교 요약에만 쓰며 underlying element를 바꾸지 않는다. A를 해제하면 의존하는 B도 해제한다. Escape는 picker를 취소한다.
- 자동 선택은 hover 요소를 일반 선택으로 갱신하는 picker mode다. 이 mode에서만 Delete/Backspace는 현재 선택 요소에 되돌릴 수 있는 `display: none !important` inline 선언을 적용한다. input, textarea, select, contenteditable의 키 입력은 가로채지 않는다.
- `A → B`는 두 DOM 요소의 상대 좌표와 방향성 edge gap을 측정한다. 완료된 비교는 viewport-fixed의 고대비 2px teal 치수선으로 `A.left → B.left`, `A.right → B.right`, `A.top → B.top`, `A.bottom → B.bottom` 대응 모서리 중 non-zero signed CSS px만 표시한다. 한 축에서 두 요소가 실제로 떨어져 있고 반대 축의 투영이 겹치면, 분리된 edge 사이에 positive `gap` 치수선을 추가한다. 포함·겹침은 절댓값으로 정규화하지 않고 gap line도 만들지 않으며, A/B가 사라지면 모든 비교 치수선도 제거한다. 비교 box와 요약·복사 문자열은 선택한 selector를 표시한다. 치수 라벨과 요약 라벨은 hover 시 강조되며, click은 표시 문자열을 클립보드에 복사하고 pointer drag는 measurement line을 움직이지 않은 채 라벨의 viewport-relative 위치만 변경한다. 드래그 동안 대응 line과 양 끝 tick은 강조되고 drop에서 해제된다. 이동 오프셋은 현재 탭 세션에서 유지된다. 선은 pointer-transparent이고 라벨만 클릭 가능하다. `Ruler`는 DOM 요소와 무관하게 화면의 시작점부터 끝점까지 드래그한 영역과 대각선 거리를 측정한다.
- Ruler snap은 기본으로 꺼져 있고 8px 단위로만 좌표를 맞춘다. angle은 viewport의 오른쪽 축에서 시계방향으로 계산한다. Ruler가 완료되면 그 네 edge가 guide가 되며, 다음 완료한 Ruler가 이전 guide를 교체한다. `Ruler 가이드 지우기`는 overlay와 guide state를 함께 비운다. guide는 페이지·브라우저 재시작 후에는 남지 않는 tab-local overlay다.
- 비교·Ruler·guide 계산은 `browser-layout-inspector/measurement`의 순수 API가 소유한다. 이 entrypoint는 DOM query, overlay rendering, Chrome API, assertion framework를 import하지 않는다. extension은 계산 결과를 화면에 투영하는 consumer이며, browser test는 같은 API의 structured tolerance 결과를 assertion adapter로 사용할 수 있다.
- Side Panel은 측정·선택 작업, 선택 요소 CSS Inspector, 화면 계층 DOM 트리, 페이지 스타일 추출·저장 및 JSON/PNG export를 네 패널로 분리한다. DOM 트리는 `body`부터 최대 깊이 5, 최대 240개 노드로 제한하고 extension overlay 자체는 제외한다. 노드를 선택하면 일반 선택과 CSS Inspector 대상을 그 요소로 전환한다. 페이지 스타일 추출은 읽을 수 있는 `document.styleSheets`의 CSS text만 반환하며 cross-origin CSSOM 접근 실패는 주석 진단으로 남긴다.
- Viewport PNG는 전체 페이지 stitch나 외부 전송을 하지 않는다. `captureVisibleTab`은 사용자가 extension action을 눌러 얻은 `activeTab` 범위에서만 호출한다.
- Side Panel의 기본 출력은 JSON이 아니라 CSS다. 처음 블록은 브라우저가 계산한 최종 값이며, 이후 source block은 cascade winner가 아닌 매칭 후보임을 명시한다. Grid/Flex의 계산 속성도 최종 CSS snapshot에 포함한다.
- CSS Inspector는 세 뷰를 분리한다. `Matched author declarations`는 접근 가능한 CSSOM의 selector별 선언 후보를 읽기 전용으로 보이며, `Computed`는 property 이름 순서의 브라우저 최종값을 보인다. 어떤 source 행도 cascade winner라고 표시하지 않는다.
- CSS Inspector에서 수정 가능한 행은 선택 요소의 `element.style`뿐이다. 속성과 값은 브라우저의 `CSS.supports`로 검증하고, 삭제는 underlying author cascade를 드러낸다. author stylesheet와 cross-origin CSSOM은 수정하거나 우회하지 않는다.
- JSON은 기본 표시를 대체하지 않는 명시적 데이터 교환 artifact다. `JSON 복사` 또는 `JSON 저장`을 눌렀을 때만 `browser-layout-inspector.exchange.v1`로 생성하며, export 시각, URL, viewport·scroll CSS px, DPR/visual viewport, 선택·검사·CSS Inspector·현재 작업 목록·A→B·Ruler·guide 상태를 담는다. 자동 업로드나 extension runtime 내부 상태는 포함하지 않는다.
- 실시간 편집과 숨기기는 선택 요소의 inline declaration만 바꾼다. 첫 변경 전 값을 기록하고 `선택 원복`/`전체 원복`에서 그 값만 복구한다. 변경 내역은 tab content script 메모리에만 있으며 새로고침 후 남지 않는다.

## 소비 ^validation

```bash
corepack pnpm --filter browser-layout-inspector test
corepack pnpm --filter browser-layout-inspector typecheck
corepack pnpm --filter browser-layout-inspector-extension typecheck
corepack pnpm --filter browser-layout-inspector-extension build
```
