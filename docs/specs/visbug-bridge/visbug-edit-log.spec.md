---
def:
  tier: component
  id: visbug-edit-log-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: experience
  svc: visbug-bridge
  tags: [measurement, browser, edit-log, web-component]
  links:
    - target: visbug-bridge-spec
      type: refines
  source: vendor/projectvisbug/app/edit-log/index.js
---

# visbug edit-log (vendor)

## 목적 ^purpose

`vendor/projectvisbug`의 in-page 편집 UI에서 발생하는 DOM/CSS 변경을 `EditLogEntry`로 정규화·버퍼링·재생하는 capture 레이어를 정의한다. `visbug-bridge`는 본 모듈이 `<vis-bug>`에 부착한 API를 typed surface로 재수출한다.

## 구성 ^overview

| 모듈 | 책임 |
|------|------|
| `entry.js` | nodePath, CSS/DOM snapshot diff, correlationId, `createEntry()` |
| `feature-bind.js` | `bindFeatureCall()` — feature 모듈 export lazy wrap |
| `dispatcher.js` | ring buffer, subscribe/push, overflow 정책 |
| `mutation-watcher.js` | MutationObserver baseline (`style`/`class` attr) |
| `feature-wrapper.js` | visbug feature 함수 direct wrap (`source: 'feature'`, optional `snapshotDOM`) |
| `dom-bind.js` | contenteditable blur/escape 등 DOM 캡처 (`beforeDOM`/`afterDOM`) |
| `merge.js` | correlationId 그룹 + agreement/divergence |
| `replay.js` | `css` / `feature` / `dom` 모드 재적용 |
| `formatters.js` | CSS / Script / JSON 클립보드 포맷 |
| `index.js` | `installEditLog(host)` — host API 부착 |

## host API ( `<vis-bug>` )

- `onEditLog` setter / `editlog` CustomEvent / `editLogStream()` AsyncIterable
- `getHistory({ merge })` / `clearHistory()` / `replay(entry, opts)`
- `_editLogFormatters` — panel copy용 (내부)

## EditLogEntry (확장 필드)

| 필드 | 필수 | 설명 |
|------|------|------|
| `beforeCSS` / `afterCSS` | 항상 | style snapshot diff |
| `beforeDOM` / `afterDOM` | 선택 | DOM 캡처 (`textContent`, sibling index 등) |
| `correlationId` | 항상 | CSS 변경 prop + DOM 변경(`dom`) 키로 bucket |

`beforeDOM` / `afterDOM` 예:

```json
{ "textContent": "hello" }
{ "src": { "parentPath": "...", "index": 0 }, "target": { "index": 1 } }
```

## capture 정책

1. **MutationObserver** — 모든 style/class 변경 capture (`source: 'mutation'`)
2. **Active tool inference (v1.1)** — mutation entry의 `feature`는 `host.active_tool.dataset.tool`에서 추론
3. **Feature wrapper** — `feature-bind.js` + `bindFeatureCall()`:
   - spacing: `padding`, `margin`
   - typography: `font` (size/leading/kerning/weight/alignment, `cmd+b`/`cmd+i`)
   - layout: `move`, `flex` (toolbar `align`), `position`, `boxshadow`
   - color: `hueshift` (`changeHue`), `color` (picker `applyForegroundColor` / `applyBackgroundColor` / `applyBorderColor`)
   - media: `imageswap` (`updateContentImage`, `applyBackgroundImage`)
   - content: `text` (blur/escape 시 `textContent` → `dom-bind`)
   - structural: `move` drag-reorder (`swapElements` + `beforeDOM`/`afterDOM` sibling index)

dedup 없음. `merge: 'correlated'`는 host/bridge 분석 단계.

## replay 모드

| mode | 적용 대상 |
|------|-----------|
| `css` | `afterCSS` → `element.style` |
| `feature` | `registry[entry.feature](...entry.args)` |
| `dom` | `afterDOM.textContent` (text 편집). structural swap은 `feature` + `swapElements` registry 권장 |

## 의존 방향

```
visbug-bridge  →  installEditLog API (read-only consumption)
edit-log       →  (visbug Web Component 내부 only)
```

## 테스트

- vitest: `app/edit-log/**/*.spec.js`, `app/features/**/*.wrap.spec.js`, `app/components/edit-log-panel/**/*.spec.js` (54 tests)
- playwright: `app/edit-log/integration.test.js` (15 tests — padding~text/swap feature capture)

로컬:

```bash
make visbug-demo   # 브라우저 프리뷰 (feature-wrapper 체험)
make visbug-smoke  # bundle + visbug unit + bridge unit/e2e
```

## 참조

- bridge spec: `docs/specs/visbug-bridge/visbug-bridge.spec.md`
- 설계: `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md`
