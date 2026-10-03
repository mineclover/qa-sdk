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
    - target: visbug-dom-ref-roadmap
      type: depends_on
source: vendor/projectvisbug/app/edit-log/index.js
sources:
  - packages/visbug-bridge/src/types.ts
  - packages/visbug-bridge/src/controller.ts
  - packages/visbug-bridge/src/mount.ts
  - packages/visbug-bridge/test/controller.spec.ts
  - packages/visbug-bridge/test/e2e/bridge.test.ts
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
| `mutation-watcher.js` | MutationObserver baseline (`style`/`class` attr), v1.2 noise filter |
| `target-filter.js` | VisBug chrome 요소 mutation 제외 |
| `mutation-mute.js` | 일시 UI mutation 억제 (resize drag 등) |
| `filter.js` | `filterEntries`, `mergeIntent` 소비자 preset |
| `feature-wrapper.js` | visbug feature 함수 direct wrap (`source: 'feature'`, optional `snapshotDOM`) |
| `dom-bind.js` | contenteditable blur/escape 등 DOM 캡처 (`beforeDOM`/`afterDOM`) |
| `merge.js` | correlationId 그룹 + agreement/divergence |
| `replay.js` | `css` / `feature` / `dom` 모드 재적용 |
| `formatters.js` | CSS / Script / JSON 클립보드 포맷 |
| `index.js` | `installEditLog(host)` — host API 부착 |

## host API ( `<vis-bug>` )

- `onEditLog` setter / `editlog` CustomEvent / `editLogStream()` AsyncIterable
- `getHistory({ merge: 'none' | 'correlated' | 'intent' | 'analyzed' })` / `filter` 옵션
- `buildTargetRef(element, { labelId? })` / `resolveTargetRef(catalog)` / `queryTargets(spec)` — DomRef 기반 선택·resolve API
- `getTargetRefByLabelId(labelId)` / `getTargetRefByElement(element)` — 세션 `TargetRegistry` 조회
- `resolveDomRefSymbols(element)` 옵션 — rlsc/qa-coord 같은 외부 좌표 심볼을 catalog에 주입
- `muteEditLogMutations()` / `unmuteEditLogMutations()` — resize 등 일시 UI mutation 억제
- `_editLogFormatters` — panel copy용 (내부)

## EditLogEntry (확장 필드)

| 필드 | 필수 | 설명 |
|------|------|------|
| `beforeCSS` / `afterCSS` | 항상 | style snapshot diff |
| `beforeDOM` / `afterDOM` | 선택 | DOM 캡처 (`textContent`, sibling index 등) |
| `target.catalog` | 항상 | full XPath canonical + multi-symbol catalog (`dom-ref`) |
| `target.primary` | 선택 | 사람이 읽기 좋은 1순위 심볼 (`id`/`attr`/`css` 등) |
| `target.selector` / `target.nodePath` | 항상 | 하위 호환 필드. `selector`는 `primary.value` 우선 |
| `correlationId` | 항상 | canonical target id + CSS 변경 prop + DOM 변경(`dom`) 키 + 100ms bucket |

`beforeDOM` / `afterDOM` 예:

```json
{ "textContent": "hello" }
{ "src": { "parentPath": "...", "index": 0 }, "target": { "index": 1 } }
```

## capture 정책 (v1.2)

1. **MutationObserver** — `style`/`class` attribute 변경 (`source: 'mutation'`)
2. **Noise filter (기본 `mutationCapture: 'filtered'`)**  
   - VisBug chrome (`visbug-*`, `vis-bug`, `edit-log-panel` 등) 제외  
   - **`mutationScope: 'page-edits'` (기본)** — `data-selected` 또는 `contenteditable` 노드만 mutation 수집  
   - **`contentRoot`** — Observer root = vis-bug 부모 (bridge `mountVisBug(host)` 시 `host` 경계)  
   - computed style diff 없음 → skip  
   - 동일 correlation의 `feature` 엔트리가 callback 시각 기준 100ms 이내에 있으면 mutation skip (MutationObserver가 bucket 경계를 넘어도 인접 bucket 후보를 확인)
   - resize drag 중 `muteEditLogMutations()` 구간 skip
   - feature/mutation capture는 동일 `TargetRegistry` catalog를 재사용해 target identity를 유지
3. **Debug** — `mutationCapture: 'all'` + `mutationScope: 'document'`로 v1 capture-all 복원
4. **Active tool inference (v1.1)** — mutation entry의 `feature`는 `host.active_tool.dataset.tool`에서 추론
5. **Feature wrapper** — `feature-bind.js` + `bindFeatureCall()`:
   - spacing: `padding`, `margin`
   - typography: `font` (size/leading/kerning/weight/alignment, `cmd+b`/`cmd+i`)
   - layout: `move`, `flex` (toolbar `align`), `position`, `boxshadow`
   - color: `hueshift` (`changeHue`), `color` (picker `applyForegroundColor` / `applyBackgroundColor` / `applyBorderColor`)
   - media: `imageswap` (`updateContentImage`, `applyBackgroundImage`)
   - content: `text` (blur/escape 시 `textContent` → `dom-bind`)
   - structural: `move` drag-reorder (`swapElements` + `beforeDOM`/`afterDOM` sibling index)

소비 기본값: `getHistory({ merge: 'intent' })` — feature 우선, redundant mutation 제거.  
`merge: 'correlated'` — agreement/divergence 검증용.  
bridge `entryFilter` 기본 `'feature'`.

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

- unit: `pnpm -C vendor/projectvisbug test:unit` — edit-log, DomRef, feature wrapper, selection, tutorial image fallback 포함 (현재 120 tests)
- playwright: `app/edit-log/integration.test.js` (15 tests — padding~text/swap feature capture)

로컬:

```bash
make visbug-demo   # 브라우저 프리뷰 (feature-wrapper 체험)
make visbug-smoke  # bundle + visbug unit + bridge unit/e2e
```

## 참조

- DomRef 로드맵: `docs/specs/visbug-bridge/visbug-dom-ref-roadmap.md`
- bridge spec: `docs/specs/visbug-bridge/visbug-bridge.spec.md`
- 설계: `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md`
