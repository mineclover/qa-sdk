# VisBug Phase B'3 — History Panel UI + visbug-bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase B'2의 edit-log API 위에 사용자 향 history panel UI를 얹고, qa-sdk 측 진입점인 `visbug-bridge` 패키지를 만들어 typed listener API를 노출.

**Architecture:** vendor 측에는 `<edit-log-panel>` 커스텀 엘리먼트를 추가하고 visbug toolbar에 토글을 결합. qa-sdk 측에는 unscoped `visbug-bridge` 패키지(tsup ESM/CJS dual)를 신설. bridge는 `vendor/projectvisbug/dist/`를 file: 링크로 소비하고 typed `mountVisBug()` 컨트롤러를 export.

**Tech Stack:** Vanilla JS (vendor), TypeScript + tsup (bridge), pnpm workspace, vitest, @playwright/test.

**Spec reference:** `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md` Phase B'3.

**Prerequisites:** Phase B'2 완료. `<vis-bug>` 인스턴스가 `getHistory/clearHistory/replay/editLogStream/onEditLog` 노출 + `editlog` CustomEvent dispatch.

---

## File Structure

**Create — vendor:**
- `vendor/projectvisbug/app/components/edit-log-panel/edit-log-panel.element.js`
- `vendor/projectvisbug/app/components/edit-log-panel/styles.js`
- `vendor/projectvisbug/app/components/edit-log-panel/edit-log-panel.spec.js`

**Modify — vendor:**
- `vendor/projectvisbug/app/components/index.js` — export edit-log-panel
- `vendor/projectvisbug/app/components/vis-bug/vis-bug.element.js` — toolbar 토글 + panel 마운트
- `vendor/projectvisbug/app/components/vis-bug/model.js` — toolbar 메뉴에 edit-log 추가

**Create — qa-sdk root:**
- `packages/visbug-bridge/package.json`
- `packages/visbug-bridge/tsup.config.ts`
- `packages/visbug-bridge/tsconfig.json`
- `packages/visbug-bridge/src/types.ts`
- `packages/visbug-bridge/src/mount.ts`
- `packages/visbug-bridge/src/controller.ts`
- `packages/visbug-bridge/src/index.ts`
- `packages/visbug-bridge/test/mount.spec.ts`
- `packages/visbug-bridge/test/controller.spec.ts`
- `packages/visbug-bridge/test/e2e/bridge.test.ts`
- `packages/visbug-bridge/playwright.config.ts`
- `packages/visbug-bridge/README.md`

**Modify — qa-sdk root:**
- `pnpm-workspace.yaml` — vendor 제외 명시 + visbug-bridge 포함
- `tsconfig.json` (project root) — visbug-bridge path 매핑 (필요 시)

---

## Task 1: 작업 브랜치

- [ ] **Step 1: 브랜치 생성 (vendor + monorepo 둘 다)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git checkout main
git pull --ff-only 2>/dev/null || true
git checkout -b feature/phase-b3-ui-bridge

cd /Users/junwoobang/workflow/qa-sdk
git checkout -b feature/visbug-phase-b3-ui-bridge
```

---

## Task 2: edit-log-panel 엘리먼트 — 기본 렌더

**Files:**
- Create: `vendor/projectvisbug/app/components/edit-log-panel/edit-log-panel.element.js`
- Create: `vendor/projectvisbug/app/components/edit-log-panel/styles.js`
- Create: `vendor/projectvisbug/app/components/edit-log-panel/edit-log-panel.spec.js`

- [ ] **Step 1: spec 작성 (실패)**

`app/components/edit-log-panel/edit-log-panel.spec.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(async () => {
  document.body.innerHTML = ''
  await import('./edit-log-panel.element.js')
})

describe('<edit-log-panel>', () => {
  it('registers as custom element', () => {
    expect(customElements.get('edit-log-panel')).toBeDefined()
  })

  it('renders empty state when no entries', async () => {
    const el = document.createElement('edit-log-panel')
    el.entries = []
    document.body.appendChild(el)
    await new Promise((r) => setTimeout(r, 0))
    const root = el.shadowRoot
    expect(root.textContent).toMatch(/no entries|비어/i)
  })

  it('renders entries when set', async () => {
    const el = document.createElement('edit-log-panel')
    el.entries = [
      { id: 'e1', feature: 'padding', source: 'feature', target: { selector: '#x' } },
      { id: 'e2', feature: 'margin', source: 'feature', target: { selector: '#y' } },
    ]
    document.body.appendChild(el)
    await new Promise((r) => setTimeout(r, 0))
    const items = el.shadowRoot.querySelectorAll('[data-entry]')
    expect(items.length).toBe(2)
  })

  it('clear button dispatches edit-log-clear event', async () => {
    const el = document.createElement('edit-log-panel')
    el.entries = []
    document.body.appendChild(el)
    await new Promise((r) => setTimeout(r, 0))
    let called = false
    el.addEventListener('edit-log-clear', () => { called = true })
    el.shadowRoot.querySelector('[data-action=clear]').click()
    expect(called).toBe(true)
  })

  it('copy CSS button dispatches edit-log-copy with format=css', async () => {
    const el = document.createElement('edit-log-panel')
    el.entries = [{ id: 'e1', feature: 'padding', source: 'feature', target: { selector: '#x' }, beforeCSS: {}, afterCSS: { 'padding-top': '4px' } }]
    document.body.appendChild(el)
    await new Promise((r) => setTimeout(r, 0))

    const detail = await new Promise((resolve) => {
      el.addEventListener('edit-log-copy', (e) => resolve(e.detail))
      el.shadowRoot.querySelector('[data-action=copy-css]').click()
    })
    expect(detail.format).toBe('css')
  })
})
```

- [ ] **Step 2: 실행 (실패)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx vitest run app/components/edit-log-panel/
```

vitest config의 `include` 패턴이 `app/edit-log/**/*.spec.js`만 매치하므로 `vitest.config.mjs`의 include에 `'app/components/edit-log-panel/**/*.spec.js'` 추가:

```js
test: {
  include: [
    'app/edit-log/**/*.spec.js',
    'app/components/edit-log-panel/**/*.spec.js',
  ],
  ...
}
```

다시 실행하여 FAIL 확인.

- [ ] **Step 3: styles.js 작성**

`app/components/edit-log-panel/styles.js`:

```js
export const panelCSS = `
  :host {
    display: block;
    position: fixed;
    right: 12px;
    bottom: 12px;
    width: 320px;
    max-height: 60vh;
    background: var(--vb-bg, #1a1a1a);
    color: var(--vb-fg, #e8e8e8);
    border: 1px solid var(--vb-border, #444);
    border-radius: 8px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    z-index: 999999;
    display: flex;
    flex-direction: column;
  }
  header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vb-border, #444);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  header h3 { margin: 0; font-size: 12px; }
  header button {
    background: transparent;
    color: inherit;
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font: inherit;
    margin-left: 4px;
  }
  ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
  li {
    padding: 6px 12px;
    border-bottom: 1px solid var(--vb-border-soft, #2a2a2a);
  }
  li[data-source=mutation] { opacity: 0.7; }
  .entry-meta { color: var(--vb-muted, #888); font-size: 11px; }
  .empty { padding: 24px; text-align: center; color: var(--vb-muted, #888); }
`
```

- [ ] **Step 4: edit-log-panel.element.js 구현**

`app/components/edit-log-panel/edit-log-panel.element.js`:

```js
import { panelCSS } from './styles.js'

class EditLogPanel extends HTMLElement {
  constructor() {
    super()
    this._entries = []
    this.attachShadow({ mode: 'open' })
  }

  set entries(value) {
    this._entries = Array.isArray(value) ? value : []
    this._render()
  }
  get entries() { return this._entries }

  connectedCallback() {
    this._render()
  }

  _render() {
    const root = this.shadowRoot
    if (!root) return
    const list = this._entries.length
      ? `<ul>${this._entries.map((e) => this._renderEntry(e)).join('')}</ul>`
      : '<div class="empty">no entries / 비어 있음</div>'
    root.innerHTML = `
      <style>${panelCSS}</style>
      <header>
        <h3>edit log (${this._entries.length})</h3>
        <div>
          <button data-action="copy-css" title="copy CSS">CSS</button>
          <button data-action="copy-script" title="copy script">JS</button>
          <button data-action="copy-json" title="copy JSON">JSON</button>
          <button data-action="clear" title="clear">×</button>
        </div>
      </header>
      ${list}
    `
    root.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => this._onAction(btn.dataset.action))
    })
  }

  _renderEntry(entry) {
    const sel = entry?.target?.selector || '?'
    const feat = entry?.feature || 'unknown'
    const src = entry?.source || 'unknown'
    return `<li data-entry="${entry.id}" data-source="${src}">
      <div><strong>${feat}</strong> <span class="entry-meta">${sel}</span></div>
      <div class="entry-meta">source: ${src}</div>
    </li>`
  }

  _onAction(action) {
    if (action === 'clear') {
      this.dispatchEvent(new CustomEvent('edit-log-clear', { bubbles: true, composed: true }))
      return
    }
    const formatMap = { 'copy-css': 'css', 'copy-script': 'script', 'copy-json': 'json' }
    const format = formatMap[action]
    if (format) {
      this.dispatchEvent(new CustomEvent('edit-log-copy', {
        detail: { format },
        bubbles: true,
        composed: true,
      }))
    }
  }
}

if (!customElements.get('edit-log-panel')) {
  customElements.define('edit-log-panel', EditLogPanel)
}

export { EditLogPanel }
```

- [ ] **Step 5: 테스트 통과**

```bash
npx vitest run app/components/edit-log-panel/
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/components/edit-log-panel/ vitest.config.mjs
git commit -m "feat(panel): edit-log-panel custom element (render+actions)"
```

---

## Task 3: vis-bug에서 panel 토글 결합

**Files:**
- Modify: `vendor/projectvisbug/app/components/vis-bug/vis-bug.element.js`
- Modify: `vendor/projectvisbug/app/components/vis-bug/model.js` (필요 시)
- Modify: `vendor/projectvisbug/app/components/index.js`

- [ ] **Step 1: edit-log-panel을 components/index.js에서 export**

`app/components/index.js`에 다음 라인 추가:

```js
export { EditLogPanel } from './edit-log-panel/edit-log-panel.element.js'
```

(define은 모듈 import 시점에 자동 수행됨)

- [ ] **Step 2: vis-bug.element.js에서 panel import + 마운트**

`app/components/vis-bug/vis-bug.element.js`에 import 추가:

```js
import './edit-log-panel/edit-log-panel.element.js'
```

`connectedCallback`에서 `installEditLog` 직후, 토글 가능한 panel 생성:

```js
    this._editLogPanel = document.createElement('edit-log-panel')
    this._editLogPanel.style.display = 'none'
    document.body.appendChild(this._editLogPanel)

    this._editLogPanelRefresh = () => {
      this._editLogPanel.entries = this.getHistory({ merge: 'correlated' })
    }
    this.addEventListener('editlog', this._editLogPanelRefresh)

    this._editLogPanel.addEventListener('edit-log-clear', () => {
      this.clearHistory()
      this._editLogPanelRefresh()
    })

    this._editLogPanel.addEventListener('edit-log-copy', async (e) => {
      const fmts = this._editLogFormatters
      const merged = this.getHistory({ merge: 'correlated' })
      const text =
        e.detail.format === 'css' ? fmts.toCSS(merged) :
        e.detail.format === 'script' ? fmts.toScript(merged) :
        fmts.toJSON(merged)
      try {
        await navigator.clipboard.writeText(text)
      } catch (err) {
        console.warn('[vis-bug] clipboard write failed', err)
      }
    })

    this.toggleEditLogPanel = (force) => {
      const next = typeof force === 'boolean' ? force : this._editLogPanel.style.display === 'none'
      this._editLogPanel.style.display = next ? '' : 'none'
      if (next) this._editLogPanelRefresh()
    }
```

`disconnectedCallback`에 cleanup 추가:

```js
    this._editLogPanel?.remove()
    this.removeEventListener('editlog', this._editLogPanelRefresh)
```

- [ ] **Step 3: 단축키 등록 (선택, 주력 진입은 toolbar)**

같은 `connectedCallback`에서 hotkeys 등록 위치에:

```js
    hotkeys('cmd+shift+l, ctrl+shift+l', (e) => {
      e.preventDefault()
      this.toggleEditLogPanel()
    })
```

기존 hotkeys 등록 패턴은 `vis-bug.element.js` 내 다른 hotkeys 호출을 참고해 같은 위치에 추가.

- [ ] **Step 4: 빌드 + 수동 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npm run bundle
npm run dev:server &
sleep 3
echo "open http://localhost:3000 in browser, press Cmd+Shift+L (or Ctrl+Shift+L) to toggle panel"
```

수동 확인 후 `kill %1`로 server 종료.

- [ ] **Step 5: Commit**

```bash
git add app/components/index.js app/components/vis-bug/vis-bug.element.js
git commit -m "feat(vis-bug): mount edit-log-panel + clipboard wiring + toggle hotkey"
```

---

## Task 4: visbug-bridge 패키지 scaffold

**Files:**
- Create: `packages/visbug-bridge/package.json`
- Create: `packages/visbug-bridge/tsup.config.ts`
- Create: `packages/visbug-bridge/tsconfig.json`
- Create: `packages/visbug-bridge/README.md`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: pnpm-workspace.yaml에 packages 패턴 + vendor 제외 확인**

`pnpm-workspace.yaml` 현재 상태 확인:

```bash
cat /Users/junwoobang/workflow/qa-sdk/pnpm-workspace.yaml
```

`packages` 패턴이 있고 `vendor`를 명시적으로 제외해야 함. 다음 형태가 되도록 수정:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'simulations/*'
  - '!vendor/**'
```

(기존 라인 보존하되, `!vendor/**` 추가)

- [ ] **Step 2: package.json 작성**

`packages/visbug-bridge/package.json`:

```json
{
  "name": "visbug-bridge",
  "version": "0.1.0",
  "description": "qa-sdk bridge to vendor/projectvisbug — typed Web Component mount + edit-log listener API",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "visbug": "file:../../vendor/projectvisbug"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@types/node": "^20.0.0",
    "jsdom": "^25.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: tsup.config.ts**

`packages/visbug-bridge/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2023',
})
```

- [ ] **Step 4: tsconfig.json**

`packages/visbug-bridge/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 5: README.md**

`packages/visbug-bridge/README.md`:

```markdown
# visbug-bridge

qa-sdk 모노레포에서 `vendor/projectvisbug`(fork)를 소비하는 thin bridge.

## 사용

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

## 의존

`file:../../vendor/projectvisbug`. vendor 산출물은 vendor 측 `npm run bundle` 결과를 참조한다.
```

- [ ] **Step 6: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm install
```

Expected: visbug-bridge가 workspace에 추가됨. `vendor/projectvisbug`는 file: 의존으로 연결.

- [ ] **Step 7: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git add packages/visbug-bridge/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(visbug-bridge): scaffold pnpm package (tsup ESM/CJS dual)"
```

---

## Task 5: visbug-bridge — types.ts

**Files:**
- Create: `packages/visbug-bridge/src/types.ts`

- [ ] **Step 1: 작성**

`packages/visbug-bridge/src/types.ts`:

```ts
export interface EditLogTarget {
  readonly selector: string
  readonly nodePath: string
  readonly weakRef: WeakRef<Element> | null
}

export interface EditLogEntry {
  readonly id: string
  readonly ts: number
  readonly feature: string
  readonly args: unknown
  readonly target: EditLogTarget
  readonly beforeCSS: Readonly<Record<string, string>>
  readonly afterCSS: Readonly<Record<string, string>>
  readonly source: 'feature' | 'mutation'
  readonly correlationId: string
}

export interface MergedEditLogEntry extends EditLogEntry {
  readonly sources?: ReadonlyArray<'feature' | 'mutation'>
  readonly agreement?: boolean
  readonly divergence?: Readonly<Record<string, { feature?: string; mutation?: string }>>
}

export type GetHistoryOptions =
  | { merge?: 'none' }
  | { merge: 'correlated' }
  | { merge: 'analyzed'; policy: (entries: ReadonlyArray<EditLogEntry>) => ReadonlyArray<EditLogEntry> }

export type ReplayMode = 'css' | 'feature'

export interface ReplayResult {
  readonly ok: boolean
  readonly reason?: 'target-not-found' | 'style-apply-failed' | 'feature-replay-failed' | 'unknown-mode'
  readonly cause?: unknown
  readonly warning?: 'divergent-capture'
  readonly divergence?: Readonly<Record<string, { feature?: string; mutation?: string }>>
}

export interface ReplayOptions {
  readonly mode?: ReplayMode
  readonly registry?: Record<string, (...args: unknown[]) => unknown>
}

export type EditLogListener = (entry: EditLogEntry) => void

export interface VisBugMountOptions {
  readonly bufferSize?: number
  readonly onEntry?: EditLogListener
  readonly logger?: { warn: (...args: unknown[]) => void }
}

export interface VisBugController {
  getHistory(opts?: GetHistoryOptions): ReadonlyArray<EditLogEntry | MergedEditLogEntry>
  clearHistory(): void
  replay(entry: EditLogEntry | MergedEditLogEntry, opts?: ReplayOptions): ReplayResult
  unmount(): void
  readonly entries: AsyncIterable<EditLogEntry>
}
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/visbug-bridge
pnpm typecheck
```

Expected: types-only이므로 OK.

- [ ] **Step 3: Commit**

```bash
git add packages/visbug-bridge/src/types.ts
git commit -m "feat(visbug-bridge): public types (EditLogEntry, controller, options)"
```

---

## Task 6: visbug-bridge — controller.ts (단위 테스트)

**Files:**
- Create: `packages/visbug-bridge/src/controller.ts`
- Create: `packages/visbug-bridge/test/controller.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`packages/visbug-bridge/test/controller.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createController } from '../src/controller.js'
import type { EditLogEntry } from '../src/types.js'

const mkEntry = (overrides: Partial<EditLogEntry> = {}): EditLogEntry => ({
  id: 'e', ts: 0, feature: 'padding', args: [],
  target: { selector: '#x', nodePath: 'x', weakRef: null },
  beforeCSS: {}, afterCSS: { 'padding-top': '4px' },
  source: 'feature', correlationId: 'k',
  ...overrides,
})

describe('createController', () => {
  it('delegates getHistory to host', () => {
    const host: any = {
      getHistory: vi.fn(() => [mkEntry({ id: 'a' })]),
      clearHistory: vi.fn(),
      replay: vi.fn(),
      editLogStream: vi.fn(() => ({ [Symbol.asyncIterator]() { return { next: () => Promise.resolve({ value: undefined, done: true }) } } })),
    }
    const ctrl = createController(host, () => {})
    const result = ctrl.getHistory({ merge: 'correlated' })
    expect(host.getHistory).toHaveBeenCalledWith({ merge: 'correlated' })
    expect(result[0].id).toBe('a')
  })

  it('clearHistory delegates', () => {
    const host: any = {
      getHistory: () => [],
      clearHistory: vi.fn(),
      replay: () => ({ ok: true }),
      editLogStream: () => ({ [Symbol.asyncIterator]() { return { next: () => Promise.resolve({ value: undefined, done: true }) } } }),
    }
    const ctrl = createController(host, () => {})
    ctrl.clearHistory()
    expect(host.clearHistory).toHaveBeenCalled()
  })

  it('replay forwards options', () => {
    const host: any = {
      getHistory: () => [],
      clearHistory: () => {},
      replay: vi.fn(() => ({ ok: true })),
      editLogStream: () => ({ [Symbol.asyncIterator]() { return { next: () => Promise.resolve({ value: undefined, done: true }) } } }),
    }
    const ctrl = createController(host, () => {})
    ctrl.replay(mkEntry(), { mode: 'feature', registry: {} })
    expect(host.replay).toHaveBeenCalledWith(expect.objectContaining({ id: 'e' }), { mode: 'feature', registry: {} })
  })

  it('unmount triggers detach callback', () => {
    const detach = vi.fn()
    const host: any = { getHistory: () => [], clearHistory: () => {}, replay: () => ({ ok: true }), editLogStream: () => ({ [Symbol.asyncIterator]() { return { next: () => Promise.resolve({ value: undefined, done: true }) } } }) }
    const ctrl = createController(host, detach)
    ctrl.unmount()
    expect(detach).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: vitest 실행 (실패)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/visbug-bridge
pnpm test
```

Expected: FAIL — controller.ts 미존재.

- [ ] **Step 3: controller.ts 구현**

`packages/visbug-bridge/src/controller.ts`:

```ts
import type {
  VisBugController,
  EditLogEntry,
  MergedEditLogEntry,
  GetHistoryOptions,
  ReplayOptions,
  ReplayResult,
} from './types.js'

interface VisBugHost {
  getHistory(opts?: GetHistoryOptions): ReadonlyArray<EditLogEntry | MergedEditLogEntry>
  clearHistory(): void
  replay(entry: EditLogEntry | MergedEditLogEntry, opts?: ReplayOptions): ReplayResult
  editLogStream(): AsyncIterable<EditLogEntry>
}

export function createController(host: VisBugHost, detach: () => void): VisBugController {
  return {
    getHistory: (opts) => host.getHistory(opts),
    clearHistory: () => host.clearHistory(),
    replay: (entry, opts) => host.replay(entry, opts),
    unmount: () => detach(),
    get entries() {
      return host.editLogStream()
    },
  }
}
```

- [ ] **Step 4: 테스트 통과**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git add packages/visbug-bridge/src/controller.ts packages/visbug-bridge/test/controller.spec.ts
git commit -m "feat(visbug-bridge): controller delegates to host, unmount via detach"
```

---

## Task 7: visbug-bridge — mount.ts

**Files:**
- Create: `packages/visbug-bridge/src/mount.ts`
- Create: `packages/visbug-bridge/test/mount.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`packages/visbug-bridge/test/mount.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  document.body.innerHTML = ''
  // visbug 실제 모듈은 jsdom 환경에서 일부 API 미지원이므로 customElements를 미리 등록한 stub 활용
  if (!customElements.get('vis-bug')) {
    class VisBugStub extends HTMLElement {
      _history: unknown[] = []
      onEditLog: ((e: unknown) => void) | null = null
      getHistory() { return this._history }
      clearHistory() { this._history = [] }
      replay() { return { ok: true } }
      editLogStream() {
        return { [Symbol.asyncIterator]() { return { next: () => Promise.resolve({ value: undefined, done: true }) } } }
      }
    }
    customElements.define('vis-bug', VisBugStub)
  }
})

describe('mountVisBug', () => {
  it('throws when host element is missing', async () => {
    const { mountVisBug } = await import('../src/mount.js')
    expect(() => mountVisBug(null as any, {})).toThrow()
  })

  it('appends <vis-bug> to host and returns controller', async () => {
    const { mountVisBug } = await import('../src/mount.js')
    const ctrl = mountVisBug(document.body, {})
    expect(document.body.querySelector('vis-bug')).toBeTruthy()
    expect(typeof ctrl.unmount).toBe('function')
    ctrl.unmount()
    expect(document.body.querySelector('vis-bug')).toBeNull()
  })

  it('wires onEntry callback via onEditLog setter', async () => {
    const { mountVisBug } = await import('../src/mount.js')
    const onEntry = vi.fn()
    const ctrl = mountVisBug(document.body, { onEntry })
    const visbug: any = document.body.querySelector('vis-bug')
    visbug.onEditLog?.({ id: 'e1' })
    expect(onEntry).toHaveBeenCalledWith({ id: 'e1' })
    ctrl.unmount()
  })

  it('isolates onEntry throw via logger.warn', async () => {
    const { mountVisBug } = await import('../src/mount.js')
    const warn = vi.fn()
    const onEntry = () => { throw new Error('boom') }
    const ctrl = mountVisBug(document.body, { onEntry, logger: { warn } })
    const visbug: any = document.body.querySelector('vis-bug')
    visbug.onEditLog?.({ id: 'e1' })
    expect(warn).toHaveBeenCalled()
    ctrl.unmount()
  })
})
```

- [ ] **Step 2: 실행 (실패)**

```bash
pnpm test
```

- [ ] **Step 3: mount.ts 구현**

`packages/visbug-bridge/src/mount.ts`:

```ts
import type {
  VisBugMountOptions,
  VisBugController,
  EditLogEntry,
} from './types.js'
import { createController } from './controller.js'

const DEFAULT_LOGGER = { warn: (...args: unknown[]) => console.warn('[visbug-bridge]', ...args) }

export function mountVisBug(host: HTMLElement, opts: VisBugMountOptions = {}): VisBugController {
  if (!host || !(host instanceof HTMLElement)) {
    throw new TypeError('mountVisBug: host must be an HTMLElement')
  }
  const logger = opts.logger ?? DEFAULT_LOGGER

  const visbug = document.createElement('vis-bug') as HTMLElement & {
    onEditLog?: ((e: EditLogEntry) => void) | null
    getHistory: VisBugController['getHistory']
    clearHistory: VisBugController['clearHistory']
    replay: VisBugController['replay']
    editLogStream: () => AsyncIterable<EditLogEntry>
  }
  host.appendChild(visbug)

  if (opts.onEntry) {
    const cb = opts.onEntry
    visbug.onEditLog = (entry: EditLogEntry) => {
      try {
        cb(entry)
      } catch (err) {
        logger.warn('onEntry threw', err)
      }
    }
  }

  const detach = () => {
    visbug.onEditLog = null
    visbug.remove()
  }

  return createController(visbug, detach)
}
```

- [ ] **Step 4: 테스트 통과**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git add packages/visbug-bridge/src/mount.ts packages/visbug-bridge/test/mount.spec.ts
git commit -m "feat(visbug-bridge): mountVisBug — append <vis-bug>, wire onEntry, fail-loud on bad host"
```

---

## Task 8: visbug-bridge — index.ts

**Files:**
- Create: `packages/visbug-bridge/src/index.ts`

- [ ] **Step 1: 작성**

`packages/visbug-bridge/src/index.ts`:

```ts
import 'visbug'
export { mountVisBug } from './mount.js'
export type {
  EditLogEntry,
  MergedEditLogEntry,
  EditLogTarget,
  EditLogListener,
  VisBugMountOptions,
  VisBugController,
  GetHistoryOptions,
  ReplayMode,
  ReplayOptions,
  ReplayResult,
} from './types.js'
```

`import 'visbug'`은 vendor의 vis-bug.element를 부모 모듈로 끌어와 customElements.define을 트리거한다 (vendor의 main 진입점이 vis-bug.element를 export).

- [ ] **Step 2: build 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/visbug-bridge
pnpm build
ls dist/
```

Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` 생성.

- [ ] **Step 3: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git add packages/visbug-bridge/src/index.ts
git commit -m "feat(visbug-bridge): public index re-exports"
```

---

## Task 9: visbug-bridge — playwright e2e

**Files:**
- Create: `packages/visbug-bridge/playwright.config.ts`
- Create: `packages/visbug-bridge/test/e2e/bridge.test.ts`
- Create: `packages/visbug-bridge/test/e2e/fixtures/index.html`

- [ ] **Step 1: playwright config**

`packages/visbug-bridge/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  testMatch: /.*\.test\.ts$/,
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3300',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx http-server test/e2e/fixtures -p 3300 -s',
    url: 'http://localhost:3300/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
```

- [ ] **Step 2: fixtures/index.html**

`packages/visbug-bridge/test/e2e/fixtures/index.html`:

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>visbug-bridge e2e</title></head>
<body>
  <main id="app">
    <p data-test="target">hello</p>
  </main>
  <script type="module" src="/bridge-loader.js"></script>
</body>
</html>
```

`packages/visbug-bridge/test/e2e/fixtures/bridge-loader.js`:

```js
import { mountVisBug } from '../../../dist/index.js'

window.__entries = []
window.__ctrl = mountVisBug(document.body, {
  onEntry: (e) => window.__entries.push(e),
})
```

- [ ] **Step 3: e2e 테스트 작성**

`packages/visbug-bridge/test/e2e/bridge.test.ts`:

```ts
import { test, expect } from '@playwright/test'

test('mountVisBug attaches <vis-bug> and exposes controller', async ({ page }) => {
  await page.goto('/index.html')
  const has = await page.evaluate(() => Boolean(document.querySelector('vis-bug')))
  expect(has).toBe(true)
  const ctrlOk = await page.evaluate(() => typeof (window as any).__ctrl?.getHistory === 'function')
  expect(ctrlOk).toBe(true)
})

test('http-server + bridge-loader loaded without error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/index.html')
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})
```

- [ ] **Step 4: http-server 추가 (devDependency)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/visbug-bridge
pnpm add -D http-server@^14.1.1
```

- [ ] **Step 5: build 후 e2e 실행**

```bash
pnpm build
npx playwright install chromium
pnpm test:e2e
```

Expected: 2 tests PASS. 실패 케이스:
- `vis-bug` 못 찾음 → vendor의 main(`vis-bug.element.js`)이 customElements.define을 안 함 → vendor index.js 진입점 확인 필요. 필요 시 bridge에서 명시적 define 호출.
- bridge-loader 에러 → dist 경로 문제 → 빌드 산출물 확인

- [ ] **Step 6: Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git add packages/visbug-bridge/
git commit -m "test(visbug-bridge): playwright e2e via http-server fixtures"
```

---

## Task 10: monorepo CI 통합

**Files:**
- 검증만, CI 설정은 기존 `.github/workflows/`에 visbug-bridge가 자동 포함되는지 확인

- [ ] **Step 1: pnpm test 전체 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm -r --filter visbug-bridge build
pnpm -r --filter visbug-bridge test
```

Expected: 모두 PASS.

- [ ] **Step 2: 기존 monorepo CI 워크플로 확인**

```bash
cat /Users/junwoobang/workflow/qa-sdk/.github/workflows/*.yml 2>/dev/null | head -100
```

`pnpm -r build` / `pnpm -r test` 가 있다면 visbug-bridge가 자동 포함됨. e2e는 `pnpm test:e2e` 별도 호출이 필요할 수 있음 — 별도 워크플로/잡으로 분리할지 결정 (현 단계 스코프 외, 후속).

- [ ] **Step 3: submodule pointer + monorepo commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git add vendor/projectvisbug
git status
git commit -m "chore(vendor): bump projectvisbug to phase-b3 HEAD"
```

---

## Task 11: 통합 검증

- [ ] **Step 1: vendor 측 모든 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npm run test:unit
npx playwright test
```

Expected: B'2의 unit + e2e + B'3의 panel spec 전부 PASS.

- [ ] **Step 2: bridge 측 모든 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter visbug-bridge build
pnpm --filter visbug-bridge test
pnpm --filter visbug-bridge test:e2e
```

Expected: bridge unit + e2e 모두 PASS.

- [ ] **Step 3: rlsc에서 bridge import 가능 여부 smoke (별도 commit 안 함)**

```bash
cd /Users/junwoobang/workflow/qa-sdk
node --input-type=module -e "import('visbug-bridge').then(m => console.log(Object.keys(m)))"
```

Expected: `['mountVisBug']` 출력.

---

## Self-Review Notes

**Spec coverage:**
- ✅ edit-log-panel 컴포넌트 (Task 2)
- ✅ vis-bug toolbar/단축키 통합 + 클립보드 wiring (Task 3)
- ✅ visbug-bridge unscoped 패키지 + tsup ESM/CJS dual (Tasks 4-8)
- ✅ typed mount/controller (Tasks 5-7)
- ✅ playwright e2e (Task 9)
- ✅ pnpm workspace 통합 (Task 4)

**Out of plan (스펙 명시 후속):**
- def-catalog 좌표 부여 (`docs/specs/visbug-bridge/`) — 별도 PR
- localStorage 영속화 — host 책임 (spec)
- replay v2 UI — verification 외 user-facing은 v2

**위험 요소:**
- vendor의 main 진입점이 customElements.define을 하는지 확인 필요 (Task 9 Step 5 fallback 명시)
- jsdom에서 visbug 실제 코드 로드 시 일부 API 미지원 — bridge 단위 테스트는 stub 기반 (Task 7)
- vendor file: 의존이 pnpm에서 dist를 빌드 트리거 안 함 — 명시적 vendor build를 bridge build 전에 실행해야 함. README/Task 11에서 노트.
