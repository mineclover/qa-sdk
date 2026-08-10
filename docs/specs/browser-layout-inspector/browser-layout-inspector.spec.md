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
  - packages/browser-layout-inspector/src/computed-style.ts
  - packages/browser-layout-inspector/src/metrics.ts
  - packages/browser-layout-inspector/test/inspector.test.ts
  - packages/browser-layout-inspector-extension/src/content.ts
  - packages/browser-layout-inspector-extension/src/page-tools.ts
  - packages/browser-layout-inspector-extension/src/protocol.ts
  - packages/browser-layout-inspector-extension/src/background.ts
  - packages/browser-layout-inspector-extension/src/css-output.ts
  - packages/browser-layout-inspector-extension/src/json-output.ts
  - packages/browser-layout-inspector-extension/public/manifest.json
---

# Browser Layout Inspector

## 목적 ^purpose

브라우저 extension content script가 페이지에서 직접 선택한 DOM의 CSS source 후보, 최종 적용 style, CSS px geometry, 상대·절대 위치를 분리해 읽고, 두 요소 간 거리를 측정하며, 탭 안에서만 유효한 inline style을 안전하게 편집·원복한다.

## API ^overview

| API | 반환 책임 |
|---|---|
| `collectCssInfluences(element)` | 현재 활성 stylesheet에서 매칭된 selector별 declarations, inline style, 읽을 수 없는 stylesheet 진단 |
| `extractComputedStyle(element, properties?)` | 브라우저가 최종 계산한 style value |
| `extractElementMetrics(element)` | viewport/document rect, client rect fragments, offset/client/scroll 값, DPR |
| `extractPosition(element, reference?)` | viewport/document absolute position과 reference/offset-parent 대비 signed gap |
| `observeElementMetrics(element, callback)` | 선택적 `ResizeObserver` 기반 재측정 |
| `inspectSelectorLayout(selector)` | extension message handler용 통합 snapshot |
| `PageToolController` | 페이지 click 선택, A→B overlay 측정, tab-local mutation ledger와 복구 |
| `Ruler` | 페이지의 임의 두 viewport 점을 드래그해 폭·높이·대각선 거리 CSS px 측정 |
| `Ruler snap / guides` | 선택적으로 8px grid에 맞추고, 마지막 ruler의 양 끝을 viewport-fixed guide로 유지 |
| `Viewport PNG` | action으로 획득한 `activeTab` 권한으로 현재 보이는 페이지와 overlay를 PNG로 저장 |
| `formatInspectionAsCss(inspection)` | 최종 computed CSS와 label된 matched source 후보를 복사 가능한 CSS 텍스트로 투영 |
| `createLayoutExchange(state)` / `formatLayoutExchangeJson(state)` | `browser-layout-inspector.exchange.v1` JSON 데이터 교환 artifact를 생성 |
| MV3 Side Panel | action click으로 지속되는 현재 탭 도구 surface와 content state 자동 갱신 |

## 경계 ^constraint

- 모든 geometry는 CSS px다. `devicePixelRatio`는 관측값으로만 반환하며 변환하지 않는다.
- `matchedSelectors`는 현재 상태에서 DOM selector가 매칭된 CSS source 후보이며, 표준 CSSOM은 property별 cascade winner provenance를 제공하지 않는다. 최종 값은 반드시 `computedStyle`에서 읽는다.
- cross-origin stylesheet의 `cssRules`가 브라우저에 의해 차단되면 `inaccessibleStylesheets`에 기록한다. 권한 확장이나 우회로 읽지 않는다.
- MV3 shell은 `activeTab`, `scripting`, `sidePanel`만 요청한다. action click은 popup이 아니라 Side Panel을 열며, 사용자가 그 패널에서 검사할 때만 content script를 주입한다.
- 선택·측정 overlay는 `pointer-events: none`이며 picker가 활성화된 동안에만 page click을 capture한다. Escape는 picker를 취소한다.
- `A → B`는 두 DOM 요소의 상대 좌표와 방향성 edge gap을 측정한다. `Ruler`는 DOM 요소와 무관하게 화면의 시작점부터 끝점까지 드래그한 영역과 대각선 거리를 측정한다.
- Ruler snap은 기본으로 꺼져 있고 8px 단위로만 좌표를 맞춘다. angle은 viewport의 오른쪽 축에서 시계방향으로 계산한다. guide는 페이지·브라우저 재시작 후에는 남지 않는 tab-local overlay다.
- Viewport PNG는 전체 페이지 stitch나 외부 전송을 하지 않는다. `captureVisibleTab`은 사용자가 extension action을 눌러 얻은 `activeTab` 범위에서만 호출한다.
- Side Panel의 기본 출력은 JSON이 아니라 CSS다. 처음 블록은 브라우저가 계산한 최종 값이며, 이후 source block은 cascade winner가 아닌 매칭 후보임을 명시한다. Grid/Flex의 계산 속성도 최종 CSS snapshot에 포함한다.
- JSON은 기본 표시를 대체하지 않는 명시적 데이터 교환 artifact다. `JSON 복사` 또는 `JSON 저장`을 눌렀을 때만 `browser-layout-inspector.exchange.v1`로 생성하며, export 시각, URL, viewport·scroll CSS px, DPR/visual viewport, 선택·검사·A→B·Ruler·guide 상태를 담는다. 자동 업로드나 extension runtime 내부 상태는 포함하지 않는다.
- 실시간 편집과 숨기기는 선택 요소의 inline declaration만 바꾼다. 첫 변경 전 값을 기록하고 `선택 원복`/`전체 원복`에서 그 값만 복구한다. 변경 내역은 tab content script 메모리에만 있으며 새로고침 후 남지 않는다.

## 소비 ^validation

```bash
corepack pnpm --filter browser-layout-inspector test
corepack pnpm --filter browser-layout-inspector typecheck
corepack pnpm --filter browser-layout-inspector-extension typecheck
corepack pnpm --filter browser-layout-inspector-extension build
```
