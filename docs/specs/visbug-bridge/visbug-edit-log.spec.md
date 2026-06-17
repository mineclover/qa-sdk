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
| `entry.js` | nodePath, CSS snapshot diff, correlationId, `createEntry()` |
| `dispatcher.js` | ring buffer, subscribe/push, overflow 정책 |
| `mutation-watcher.js` | MutationObserver baseline (`style`/`class` attr) |
| `feature-wrapper.js` | visbug feature 함수 direct wrap (`source: 'feature'`) |
| `merge.js` | correlationId 그룹 + agreement/divergence |
| `replay.js` | `css` / `feature` 모드 재적용 |
| `formatters.js` | CSS / Script / JSON 클립보드 포맷 |
| `index.js` | `installEditLog(host)` — host API 부착 |

## host API ( `<vis-bug>` )

- `onEditLog` setter / `editlog` CustomEvent / `editLogStream()` AsyncIterable
- `getHistory({ merge })` / `clearHistory()` / `replay(entry, opts)`
- `_editLogFormatters` — panel copy용 (내부)

## capture 정책

1. **MutationObserver** — 모든 style/class 변경 capture (`source: 'mutation'`)
2. **Active tool inference (v1.1)** — mutation entry의 `feature`는 `host.active_tool.dataset.tool`에서 추론
3. **Feature wrapper (pilot)** — `feature-bind.js` + `bindFeatureCall()`으로 padding/margin/font export 함수 wrap → `source: 'feature'`, `args` 포함
4. **Feature wrapper (확장)** — move, flex, boxshadow 등 나머지 feature 모듈

dedup 없음. `merge: 'correlated'`는 host/bridge 분석 단계.

## 의존 방향

```
visbug-bridge  →  installEditLog API (read-only consumption)
edit-log       →  (visbug Web Component 내부 only)
```

## 테스트

- vitest: `app/edit-log/*.spec.js` (unit)
- playwright: `app/edit-log/integration.test.js` (padding tool E2E)

로컬:

```bash
pnpm --filter visbug run bundle
pnpm --filter visbug test:unit
pnpm --filter visbug test -- app/edit-log/integration.test.js
```

## 참조

- bridge spec: `docs/specs/visbug-bridge/visbug-bridge.spec.md`
- 설계: `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md`
