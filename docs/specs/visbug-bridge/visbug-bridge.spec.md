---
def:
  tier: component
  id: visbug-bridge-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: visbug-bridge
  tags: [measurement, browser, edit-log, web-component]
  links:
    - target: rlsc-integration
      type: depends_on
    - target: visbug-edit-log-spec
      type: depends_on
  source: packages/visbug-bridge/src/index.ts
---

# visbug-bridge

## 목적 ^purpose

`vendor/projectvisbug` (forked Web Component)을 qa-sdk 모노레포에서 typed API로 소비하기 위한 thin bridge 패키지. 사용자가 visbug로 페이지를 편집한 인텐트(`EditLogEntry`)를 capture하고, host(rlsc/측정 도구)가 listener로 구독·분석할 수 있게 한다.

## 구성 ^overview

- **패키지 위치**: `packages/visbug-bridge/` (unscoped, tsup ESM/CJS dual)
- **vendor 의존**: `"visbug": "workspace:*"` (`vendor/projectvisbug` git submodule, pnpm workspace 편입)
- **공개 API**: `mountVisBug(host, opts) → VisBugController`
  - controller: `getHistory({merge})`, `clearHistory()`, `replay(entry, {mode})`, `buildTargetRef(element)`, `resolveTargetRef(catalog)`, `queryTargets(spec)`, `getTargetRefByLabelId(labelId)`, `unmount()`, `entries: AsyncIterable<EditLogEntry>`
  - opts: `bufferSize?`, `colorScheme?: 'light'|'dark'|'auto'`, `onEntry?: (entry) => void`, `entryFilter?: 'feature'|'intent'|'all'|'mutation-debug'` (기본 `feature`), `resolveDomRefSymbols?: (element) => DomRefSymbol[]`, `createDomRefSymbolResolver({ rlsc, qaCoord })`, `logger?: { warn }`
- **Entry 형태**: `EditLogEntry = { id, ts, feature, args, target: {selector, nodePath, catalog, primary, weakRef}, beforeCSS, afterCSS, beforeDOM?, afterDOM?, source: 'feature'|'mutation', correlationId }`
- **Merge 정책**: `'none'` (raw) / `'correlated'` (correlationId 그룹핑 + agreement/divergence) / `'analyzed'` (host 정의 policy)
- **Replay 모드**: `'css'` (afterCSS 직접 적용) / `'feature'` (registry로 visbug feature 함수 재호출) / `'dom'` (`afterDOM.textContent` 복원)

## 데이터 흐름

```
[측정 페이지 DOM]
   └─→ visbug Web Component (in-page 편집 UI)
        └─→ MutationObserver baseline → EditLogEntry { source: 'mutation' }
        └─→ (v1.1+) feature wrapper → EditLogEntry { source: 'feature' }
              ↓
        dispatcher (ring buffer + listeners)
              ↓
        ┌────┴────┬─────────┬──────────────┐
        ↓         ↓         ↓              ↓
     CustomEvent onEditLog  AsyncIterable  getHistory()
     ('editlog') setter
              ↓
        host (rlsc / 측정 도구)
        - `resolveDomRefSymbols(element)` → `entry.target.catalog.symbols[]`에 `rlsc`/`qa-coord` 심볼 주입
        - 인텐트 데이터 적재
```

## 책임 분리

| 책임 | 위치 |
|---|---|
| in-page 편집 UI + DOM mutation | `vendor/projectvisbug` (Web Component) |
| capture / dispatch / merge / replay | `vendor/projectvisbug/app/edit-log/` (10 모듈 + `feature-bind`) |
| typed API surface (브라우저 향) | `packages/visbug-bridge/src/` |
| 인텐트 좌표 join + 적재 | host (rlsc / 측정 파이프라인) |
| 영속화 / 송신 | host |

bridge는 **무상태**. 모든 상태는 `<vis-bug>` 인스턴스 내부 ring buffer.

## 의존 방향

```
host (rlsc / 측정 도구)  →  visbug-bridge  →  vendor/projectvisbug/dist/
```

역방향 금지. visbug-bridge는 rlsc/pretext를 import하지 않음.

## 테스트 전략

- **단위 (vitest + jsdom)**: `controller.spec.ts`, `mount.spec.ts`, `coordinate-symbols.spec.ts`, `rlsc-integration.spec.ts` (18 tests). `<vis-bug>` 실제 모듈은 jsdom 호환 안 됨 → stub element로 대체.
- **e2e (playwright + chromium)**: `test/e2e/bridge.test.ts` (2 tests). http-server로 monorepo root 제공, importmap으로 vendor bundle을 `'visbug'` 식별자에 바인딩.

## 브라우저 지원선

WeakRef / AsyncIterator / CustomElements v1 / MutationObserver — Chrome 86+, Firefox 79+, Safari 14.1+, Edge 86+.

## 비스코프

- localStorage 영속화: host 책임
- replay UI 노출: v1은 verification 도구로만 (UI 없음)
- Chrome/Firefox/Edge extension build script는 vendor fork에 포함. Safari Xcode release pipeline은 후속.
- def-catalog `visbug-edit-log` 서브 스펙: `docs/specs/visbug-bridge/visbug-edit-log.spec.md`

## 변경 이력

- **2026-06-18** — DomRef D5b smoke 복원: `pnpm-mcp/packages/rlsc-analysis` collector/index 기반 `rlsc` symbol + XPath fallback join 검증 (`packages/visbug-bridge/test/rlsc-integration.spec.ts`)
  - 검증: bridge unit 18/18 + typecheck, vendor unit 105/105
- **2026-06-17** — edit-log v1.2: mutation noise filter, `merge: 'intent'`, bridge `entryFilter`, extension build scripts
- **2026-06-17** — feature-wrapper 전면 확장 + DOM 캡처 (`dom-bind`, `beforeDOM`/`afterDOM`, replay `dom` mode)
  - feature: padding~imageswap, text (contenteditable), move drag `swapElements`
  - 검증(당시): vendor vitest 54/54, edit-log integration 15/15
- **2026-04-27** — Phase B'1/B'2/B'3 완료 + FU 4건 머지 (def-catalog 좌표, font 회귀 fix, CI e2e 잡, rlsc 통합 smoke)
  - vendor `194264c` (main), monorepo `58cd8ae5` (main)
  - 검증: vendor playwright 61/61, vendor vitest 42/42, bridge unit 8/8 + e2e 2/2, rlsc 155/155

## 참조

- 설계: `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md`
- 구현 plan:
  - `docs/superpowers/plans/2026-04-27-visbug-phase-b1-modernization.md`
  - `docs/superpowers/plans/2026-04-27-visbug-phase-b2-edit-log-core.md`
  - `docs/superpowers/plans/2026-04-27-visbug-phase-b3-ui-and-bridge.md`
- 코드:
  - `packages/visbug-bridge/src/index.ts` — public exports
  - `packages/visbug-bridge/src/mount.ts` — `mountVisBug()`
  - `packages/visbug-bridge/src/controller.ts` — `createController()`
  - `packages/visbug-bridge/src/types.ts` — TS 타입
  - `vendor/projectvisbug/app/edit-log/` — capture/dispatch/replay 모듈
