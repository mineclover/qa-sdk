# visbug-bridge

qa-sdk 모노레포에서 `vendor/projectvisbug`(fork)를 소비하는 thin bridge. 사용자가 visbug로 페이지를 편집한 인텐트(`EditLogEntry`)를 capture하고, host(rlsc/측정 도구)가 listener로 구독·분석할 수 있게 한다.

## 빠른 시작

```ts
import { mountVisBug } from 'visbug-bridge'

const ctrl = mountVisBug(document.body, {
  bufferSize: 500,
  onEntry: (entry) => {
    // entry: EditLogEntry
  },
})

const merged = ctrl.getHistory({ merge: 'correlated' })
ctrl.clearHistory()
const result = ctrl.replay(merged[0], { mode: 'css' })
ctrl.unmount()
```

## API

### `mountVisBug(host, opts) → VisBugController`

- `host: HTMLElement` — `<vis-bug>`이 append될 부모. 필수.
- `opts.bufferSize?: number` — ring buffer 최대 크기. 기본 1000.
- `opts.onEntry?: (entry: EditLogEntry) => void` — 단일 listener. 예외는 `logger.warn`으로 격리.
- `opts.logger?: { warn }` — 미지정 시 `console.warn`.

### `VisBugController`

| 메서드 | 설명 |
|---|---|
| `getHistory(opts?)` | `merge: 'none' \| 'correlated' \| 'analyzed'` 옵션. 기본 `'none'` (raw). |
| `clearHistory()` | ring buffer 비움. |
| `replay(entry, {mode})` | `mode: 'css'` (afterCSS) / `'feature'` (registry 재호출) / `'dom'` (`afterDOM.textContent`). 결과 `{ ok, reason?, warning?, divergence? }`. |
| `unmount()` | `<vis-bug>` 제거 + listener 해제. |
| `entries` | `AsyncIterable<EditLogEntry>`. `for await` 또는 stream 소비. |

### `EditLogEntry`

```ts
interface EditLogEntry {
  id: string
  ts: number
  feature: string                // visbug tool/feature name
  args: unknown
  target: { selector, nodePath, weakRef }
  beforeCSS: Record<string, string>
  afterCSS: Record<string, string>
  beforeDOM?: Record<string, unknown>  // textContent, sibling index 등
  afterDOM?: Record<string, unknown>
  source: 'feature' | 'mutation'
  correlationId: string
}
```

`merge: 'correlated'` 시 `MergedEditLogEntry`로 확장되어 `sources`, `agreement`, `divergence` 필드 포함.

## RLSC와 통합

EditLogEntry → RLSCNode 좌표 join 패턴은 별도 문서 참조.

- 패턴 + 코드 예: `pnpm-mcp/packages/rlsc/docs/visbug-bridge-integration.md`
- 좌표 join smoke test: `pnpm-mcp/packages/rlsc/src/visbug-bridge-join.test.ts`

## 의존 + 빌드 절차

```
visbug-bridge → visbug (workspace:*) → vendor/projectvisbug/app/bundle.js (rollup 4 ESM)
```

vendor 산출물 빌드:
```bash
pnpm --filter visbug run bundle
```

bridge 빌드:
```bash
pnpm --filter visbug-bridge build
```

## 테스트

```bash
pnpm --filter visbug-bridge test       # vitest 단위 (controller + mount, 8 tests)
pnpm --filter visbug-bridge test:e2e   # playwright e2e (chromium + http-server, 2 tests)
```

E2E는 chromium이 설치되어 있어야 함:
```bash
pnpm --filter visbug-bridge exec playwright install chromium
```

## 브라우저 지원선

WeakRef / AsyncIterator / CustomElements v1 / MutationObserver — Chrome 86+, Firefox 79+, Safari 14.1+, Edge 86+.

## 관련 문서

- 스펙: `docs/specs/visbug-bridge/visbug-bridge.spec.md`
- 설계: `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md`
- CI 통합: `./CI.md`
