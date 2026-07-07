---
status: source-backed
sources:
  - docs/specs/visbug-bridge/visbug-edit-log.spec.md
  - packages/visbug-bridge/src/types.ts
  - packages/visbug-bridge/src/controller.ts
  - packages/visbug-bridge/test/controller.spec.ts
  - packages/visbug-bridge/test/e2e/bridge.test.ts
---

# VisBug Phase B'2 — edit-log core Implementation Plan

> **Status: 완료 (2026-04-27)** — vendor SHA `8bbb606`, monorepo SHA `0fedfda9`. vitest 37/37 + playwright e2e 4/4 PASS.
>
> **Deviation: Task 11 스킵** — visbug features는 module-level closure 기반 (`Padding(visbug)` factory 안에서 hotkey 핸들러가 worker 함수를 직접 호출). ES 모듈 export 불변성으로 host method monkey-patch 불가. v1은 MutationObserver baseline에 의존 (모든 entry `source: 'mutation'`, `feature: 'unknown'`). feature 의미 복원은 consumer 측 CSS prop 매핑 또는 v1.1에서 features/*.js 소스 수정 필요.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `<vis-bug>` Web Component에 사용자 편집 캡처 + listener API + verification replay를 추가. UI 없음, headless 측정 가능 시점.

**Architecture:** `app/edit-log/`에 8개 단위 모듈(entry/dispatcher/mutation-watcher/feature-wrapper/merge/formatters/replay/index). 각 모듈은 단일 책임 + vitest 단위 테스트. `<vis-bug>` 인스턴스에 install 시 CustomEvent + 인스턴스 메서드/setter 노출. capture-all 정책(wrapper와 mutation 모두 push), 분석 단계에서 correlationId로 병합.

**Tech Stack:** Vanilla JS (vendor 컨벤션), vitest 2 + jsdom, @playwright/test 1.50+, MutationObserver, CustomEvent, AsyncIterable, WeakRef.

**Spec reference:** `docs/superpowers/specs/2026-04-27-visbug-modernization-and-edit-log-design.md` Phase B'2.

**Prerequisites:** Phase B'1 완료 (rollup 4 / vitest / playwright / postcss 8). `vendor/projectvisbug/app/edit-log/` 디렉터리 미존재 상태에서 시작.

**Working directory:** `cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug` 기준. 파일 경로는 vendor 내부 상대.

---

## File Structure

**Create (Phase B'2 신규):**
- `app/edit-log/entry.js` — EditLogEntry 팩토리, snapshot/diff
- `app/edit-log/entry.spec.js` — vitest
- `app/edit-log/dispatcher.js` — ring buffer + subscribe
- `app/edit-log/dispatcher.spec.js`
- `app/edit-log/mutation-watcher.js` — MutationObserver baseline
- `app/edit-log/mutation-watcher.spec.js`
- `app/edit-log/feature-wrapper.js` — features/* monkey-patch
- `app/edit-log/feature-wrapper.spec.js`
- `app/edit-log/merge.js` — correlationId 병합
- `app/edit-log/merge.spec.js`
- `app/edit-log/formatters.js` — toCSS/toScript/toJSON
- `app/edit-log/formatters.spec.js`
- `app/edit-log/replay.js` — replay({mode})
- `app/edit-log/replay.spec.js`
- `app/edit-log/index.js` — install(host) 통합
- `app/edit-log/integration.test.js` — playwright e2e

**Modify:**
- `app/components/vis-bug/vis-bug.element.js` — install 호출 + 인스턴스 API 추가

---

## Task 1: 작업 브랜치

- [ ] **Step 1: 브랜치 생성**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
git checkout main
git pull --ff-only 2>/dev/null || true
git checkout -b feature/phase-b2-edit-log
```

Expected: B'1 머지된 main 위에 새 브랜치.

---

## Task 2: entry.js — EditLogEntry 팩토리

**Files:**
- Create: `app/edit-log/entry.js`
- Test: `app/edit-log/entry.spec.js`

- [ ] **Step 1: 실패 테스트 작성**

`app/edit-log/entry.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  computeNodePath,
  snapshotComputedStyle,
  diffSnapshots,
  computeCorrelationId,
  createEntry,
} from './entry.js'

describe('computeNodePath', () => {
  it('returns same path for same node twice', () => {
    document.body.innerHTML = '<div><span id="x"></span></div>'
    const node = document.getElementById('x')
    expect(computeNodePath(node)).toBe(computeNodePath(node))
  })

  it('encodes ancestor index', () => {
    document.body.innerHTML = '<section><p></p><p id="t"></p></section>'
    const node = document.getElementById('t')
    expect(computeNodePath(node)).toMatch(/section\[\d+\]>p\[1\]/)
  })
})

describe('snapshotComputedStyle', () => {
  it('returns only requested props', () => {
    document.body.innerHTML = '<div id="x" style="padding-top: 4px; color: red;"></div>'
    const node = document.getElementById('x')
    const snap = snapshotComputedStyle(node, ['padding-top', 'color'])
    expect(Object.keys(snap).sort()).toEqual(['color', 'padding-top'])
    expect(snap['padding-top']).toBe('4px')
  })
})

describe('diffSnapshots', () => {
  it('returns props that changed', () => {
    const before = { 'padding-top': '4px', color: 'red' }
    const after = { 'padding-top': '8px', color: 'red' }
    expect(diffSnapshots(before, after)).toEqual(['padding-top'])
  })

  it('returns empty array when nothing changed', () => {
    const before = { 'padding-top': '4px' }
    const after = { 'padding-top': '4px' }
    expect(diffSnapshots(before, after)).toEqual([])
  })
})

describe('computeCorrelationId', () => {
  it('is deterministic for same inputs', () => {
    const id1 = computeCorrelationId('html>body>div[0]', ['padding-top'], 1700000000000)
    const id2 = computeCorrelationId('html>body>div[0]', ['padding-top'], 1700000000000)
    expect(id1).toBe(id2)
  })

  it('uses 100ms bucket (same id within bucket)', () => {
    const id1 = computeCorrelationId('p', ['x'], 1700000000050)
    const id2 = computeCorrelationId('p', ['x'], 1700000000099)
    expect(id1).toBe(id2)
  })

  it('changes across bucket boundary', () => {
    const id1 = computeCorrelationId('p', ['x'], 1700000000099)
    const id2 = computeCorrelationId('p', ['x'], 1700000000100)
    expect(id1).not.toBe(id2)
  })

  it('changes when changedProps differ', () => {
    const id1 = computeCorrelationId('p', ['padding-top'], 1700000000000)
    const id2 = computeCorrelationId('p', ['margin-top'], 1700000000000)
    expect(id1).not.toBe(id2)
  })
})

describe('createEntry', () => {
  it('produces a normalized entry shape', () => {
    document.body.innerHTML = '<p id="t"></p>'
    const target = document.getElementById('t')
    const entry = createEntry({
      target,
      feature: 'padding',
      args: { side: 'top', delta: 1 },
      beforeCSS: { 'padding-top': '0px' },
      afterCSS: { 'padding-top': '1px' },
      source: 'feature',
      ts: 1700000000000,
    })
    expect(entry.id).toMatch(/^e_/)
    expect(entry.feature).toBe('padding')
    expect(entry.source).toBe('feature')
    expect(entry.target.nodePath).toMatch(/p/)
    expect(entry.target.weakRef).toBeInstanceOf(WeakRef)
    expect(entry.correlationId).toBeDefined()
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx vitest run app/edit-log/entry.spec.js
```

Expected: FAIL — `entry.js` 미존재.

- [ ] **Step 3: entry.js 구현**

`app/edit-log/entry.js`:

```js
const BUCKET_MS = 100

let _entrySeq = 0

export function computeNodePath(node) {
  if (!node || node.nodeType !== 1) return ''
  const segments = []
  let cur = node
  while (cur && cur.nodeType === 1 && cur !== document.documentElement.parentNode) {
    const parent = cur.parentNode
    if (!parent || parent === document) {
      segments.unshift(cur.tagName.toLowerCase())
      break
    }
    const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName)
    const idx = siblings.indexOf(cur)
    segments.unshift(`${cur.tagName.toLowerCase()}[${idx}]`)
    cur = parent
  }
  return segments.join('>')
}

export function snapshotComputedStyle(node, props) {
  if (!node) return {}
  const style = node.ownerDocument.defaultView.getComputedStyle(node)
  const snap = {}
  for (const p of props) {
    snap[p] = style.getPropertyValue(p).trim()
  }
  return snap
}

export function diffSnapshots(before, after) {
  const changed = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const k of allKeys) {
    if (before[k] !== after[k]) changed.push(k)
  }
  return changed.sort()
}

export function computeCorrelationId(nodePath, changedProps, ts) {
  const bucket = Math.floor(ts / BUCKET_MS)
  const propKey = [...changedProps].sort().join(',')
  return `${nodePath}|${propKey}|${bucket}`
}

export function createEntry({ target, feature, args, beforeCSS, afterCSS, source, ts }) {
  const nodePath = computeNodePath(target)
  const changedProps = diffSnapshots(beforeCSS, afterCSS)
  const correlationId = computeCorrelationId(nodePath, changedProps, ts)
  const id = `e_${ts}_${++_entrySeq}`
  return Object.freeze({
    id,
    ts,
    feature,
    args,
    target: Object.freeze({
      selector: target?.id ? `#${target.id}` : nodePath,
      nodePath,
      weakRef: target ? new WeakRef(target) : null,
    }),
    beforeCSS: Object.freeze({ ...beforeCSS }),
    afterCSS: Object.freeze({ ...afterCSS }),
    source,
    correlationId,
  })
}
```

- [ ] **Step 4: 테스트 재실행 (통과 확인)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx vitest run app/edit-log/entry.spec.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/edit-log/entry.js app/edit-log/entry.spec.js
git commit -m "feat(edit-log): entry factory + snapshot/diff/correlationId"
```

---

## Task 3: dispatcher.js — Ring Buffer + Subscribe

**Files:**
- Create: `app/edit-log/dispatcher.js`
- Test: `app/edit-log/dispatcher.spec.js`

- [ ] **Step 1: 실패 테스트 작성**

`app/edit-log/dispatcher.spec.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createDispatcher } from './dispatcher.js'

const mkEntry = (i) => ({ id: `e${i}`, ts: i, source: 'feature' })

describe('createDispatcher', () => {
  it('push then getAll returns entries in order', () => {
    const d = createDispatcher()
    d.push(mkEntry(1))
    d.push(mkEntry(2))
    expect(d.getAll().map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('subscribe is called for each push', () => {
    const d = createDispatcher()
    const cb = vi.fn()
    d.subscribe(cb)
    d.push(mkEntry(1))
    d.push(mkEntry(2))
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb.mock.calls[0][0].id).toBe('e1')
  })

  it('multiple subscribers all receive', () => {
    const d = createDispatcher()
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    d.subscribe(cb1)
    d.subscribe(cb2)
    d.push(mkEntry(1))
    expect(cb1).toHaveBeenCalledOnce()
    expect(cb2).toHaveBeenCalledOnce()
  })

  it('unsubscribe stops further calls', () => {
    const d = createDispatcher()
    const cb = vi.fn()
    const unsub = d.subscribe(cb)
    d.push(mkEntry(1))
    unsub()
    d.push(mkEntry(2))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('listener throwing does not block other listeners', () => {
    const d = createDispatcher()
    const cbBad = vi.fn(() => { throw new Error('boom') })
    const cbGood = vi.fn()
    d.subscribe(cbBad)
    d.subscribe(cbGood)
    d.push(mkEntry(1))
    expect(cbGood).toHaveBeenCalledOnce()
  })

  it('ring buffer evicts oldest at maxSize', () => {
    const d = createDispatcher({ maxSize: 3 })
    d.push(mkEntry(1))
    d.push(mkEntry(2))
    d.push(mkEntry(3))
    d.push(mkEntry(4))
    expect(d.getAll().map((e) => e.id)).toEqual(['e2', 'e3', 'e4'])
  })

  it('clear empties buffer', () => {
    const d = createDispatcher()
    d.push(mkEntry(1))
    d.clear()
    expect(d.getAll()).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run app/edit-log/dispatcher.spec.js
```

Expected: FAIL.

- [ ] **Step 3: dispatcher.js 구현**

`app/edit-log/dispatcher.js`:

```js
const DEFAULT_MAX = 1000

export function createDispatcher({ maxSize = DEFAULT_MAX, onWarn = console.warn } = {}) {
  const buffer = []
  const listeners = new Set()
  let evictedOnce = false

  return {
    push(entry) {
      buffer.push(entry)
      if (buffer.length > maxSize) {
        buffer.shift()
        if (!evictedOnce) {
          onWarn('editLog: ring buffer evicted oldest entry; bufferSize=', maxSize)
          evictedOnce = true
        }
      }
      for (const cb of listeners) {
        try {
          cb(entry)
        } catch (err) {
          onWarn('editLog: listener threw', err)
        }
      }
    },
    getAll() {
      return buffer.slice()
    },
    clear() {
      buffer.length = 0
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run app/edit-log/dispatcher.spec.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/edit-log/dispatcher.js app/edit-log/dispatcher.spec.js
git commit -m "feat(edit-log): dispatcher (ring buffer + subscribe with error isolation)"
```

---

## Task 4: mutation-watcher.js — MutationObserver baseline

**Files:**
- Create: `app/edit-log/mutation-watcher.js`
- Test: `app/edit-log/mutation-watcher.spec.js`

- [ ] **Step 1: 실패 테스트 작성**

`app/edit-log/mutation-watcher.spec.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMutationWatcher } from './mutation-watcher.js'
import { createDispatcher } from './dispatcher.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 10))

describe('createMutationWatcher', () => {
  let watcher
  let dispatcher

  beforeEach(() => {
    document.body.innerHTML = '<div id="x" style="padding: 0px"></div>'
    dispatcher = createDispatcher()
  })

  afterEach(() => {
    watcher?.stop()
  })

  it('captures style attribute changes', async () => {
    watcher = createMutationWatcher({ root: document.body, dispatcher })
    watcher.start()
    document.getElementById('x').style.paddingTop = '4px'
    await flush()
    const entries = dispatcher.getAll()
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0].source).toBe('mutation')
  })

  it('captures class attribute changes', async () => {
    watcher = createMutationWatcher({ root: document.body, dispatcher })
    watcher.start()
    document.getElementById('x').className = 'foo'
    await flush()
    const entries = dispatcher.getAll().filter((e) => e.source === 'mutation')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('stop disconnects observer', async () => {
    watcher = createMutationWatcher({ root: document.body, dispatcher })
    watcher.start()
    watcher.stop()
    document.getElementById('x').style.paddingTop = '4px'
    await flush()
    expect(dispatcher.getAll()).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패)**

```bash
npx vitest run app/edit-log/mutation-watcher.spec.js
```

- [ ] **Step 3: mutation-watcher.js 구현**

`app/edit-log/mutation-watcher.js`:

```js
import { createEntry, snapshotComputedStyle } from './entry.js'

const TRACKED_ATTRS = ['style', 'class']
const TRACKED_PROPS = [
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-size', 'font-family', 'font-weight', 'line-height',
  'color', 'background-color',
  'width', 'height',
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'box-shadow', 'border-radius',
]

export function createMutationWatcher({ root, dispatcher, onWarn = console.warn }) {
  let observer = null
  const beforeCache = new WeakMap()

  const observerCallback = (mutations) => {
    try {
      for (const m of mutations) {
        if (m.type !== 'attributes' || !TRACKED_ATTRS.includes(m.attributeName)) continue
        const target = m.target
        if (!target || target.nodeType !== 1) continue
        const before = beforeCache.get(target) || {}
        const after = snapshotComputedStyle(target, TRACKED_PROPS)
        const ts = Date.now()
        const entry = createEntry({
          target,
          feature: 'unknown',
          args: { attributeName: m.attributeName },
          beforeCSS: before,
          afterCSS: after,
          source: 'mutation',
          ts,
        })
        dispatcher.push(entry)
        beforeCache.set(target, after)
      }
    } catch (err) {
      onWarn('editLog: mutation observer error', err)
    }
  }

  return {
    start() {
      if (observer) return
      observer = new MutationObserver(observerCallback)
      observer.observe(root, {
        attributes: true,
        attributeFilter: TRACKED_ATTRS,
        attributeOldValue: false,
        subtree: true,
        childList: false,
        characterData: false,
      })
    },
    stop() {
      observer?.disconnect()
      observer = null
    },
  }
}
```

- [ ] **Step 4: 테스트 통과**

```bash
npx vitest run app/edit-log/mutation-watcher.spec.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/edit-log/mutation-watcher.js app/edit-log/mutation-watcher.spec.js
git commit -m "feat(edit-log): mutation watcher baseline (style/class on subtree)"
```

---

## Task 5: feature-wrapper.js — features/* monkey-patch

**Files:**
- Create: `app/edit-log/feature-wrapper.js`
- Test: `app/edit-log/feature-wrapper.spec.js`

- [ ] **Step 1: 실패 테스트 작성**

`app/edit-log/feature-wrapper.spec.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { wrapFeature } from './feature-wrapper.js'
import { createDispatcher } from './dispatcher.js'

describe('wrapFeature', () => {
  let dispatcher

  beforeEach(() => {
    document.body.innerHTML = '<div id="x"></div>'
    dispatcher = createDispatcher()
  })

  it('calls original function and pushes feature entry', () => {
    const target = document.getElementById('x')
    const original = vi.fn((node, val) => {
      node.style.paddingTop = val
    })
    const wrapped = wrapFeature({
      featureName: 'padding',
      original,
      dispatcher,
      resolveTarget: (args) => args[0],
      props: ['padding-top'],
    })

    wrapped(target, '4px')

    expect(original).toHaveBeenCalledWith(target, '4px')
    const entries = dispatcher.getAll()
    expect(entries).toHaveLength(1)
    expect(entries[0].feature).toBe('padding')
    expect(entries[0].source).toBe('feature')
    expect(entries[0].afterCSS['padding-top']).toBe('4px')
  })

  it('rethrows when original throws and does not push', () => {
    const original = vi.fn(() => { throw new Error('boom') })
    const wrapped = wrapFeature({
      featureName: 'padding',
      original,
      dispatcher,
      resolveTarget: () => document.getElementById('x'),
      props: ['padding-top'],
    })
    expect(() => wrapped()).toThrow('boom')
    expect(dispatcher.getAll()).toEqual([])
  })

  it('skips push when target cannot be resolved (warn)', () => {
    const onWarn = vi.fn()
    const original = vi.fn()
    const wrapped = wrapFeature({
      featureName: 'padding',
      original,
      dispatcher,
      resolveTarget: () => null,
      props: ['padding-top'],
      onWarn,
    })
    wrapped()
    expect(original).toHaveBeenCalled()
    expect(dispatcher.getAll()).toEqual([])
    expect(onWarn).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패)**

```bash
npx vitest run app/edit-log/feature-wrapper.spec.js
```

- [ ] **Step 3: feature-wrapper.js 구현**

`app/edit-log/feature-wrapper.js`:

```js
import { createEntry, snapshotComputedStyle } from './entry.js'

export function wrapFeature({ featureName, original, dispatcher, resolveTarget, props, onWarn = console.warn }) {
  return function wrapped(...args) {
    let target = null
    let beforeCSS = {}
    try {
      target = resolveTarget(args)
      if (target) beforeCSS = snapshotComputedStyle(target, props)
    } catch (err) {
      onWarn(`editLog[${featureName}]: pre-capture failed`, err)
    }

    const result = original.apply(this, args)

    try {
      if (!target) {
        onWarn(`editLog[${featureName}]: target unresolved, entry skipped`)
        return result
      }
      const afterCSS = snapshotComputedStyle(target, props)
      const entry = createEntry({
        target,
        feature: featureName,
        args,
        beforeCSS,
        afterCSS,
        source: 'feature',
        ts: Date.now(),
      })
      dispatcher.push(entry)
    } catch (err) {
      onWarn(`editLog[${featureName}]: post-capture failed`, err)
    }

    return result
  }
}
```

- [ ] **Step 4: 테스트 통과**

```bash
npx vitest run app/edit-log/feature-wrapper.spec.js
```

- [ ] **Step 5: Commit**

```bash
git add app/edit-log/feature-wrapper.js app/edit-log/feature-wrapper.spec.js
git commit -m "feat(edit-log): feature wrapper with pre/post capture and rethrow"
```

---

## Task 6: merge.js — correlationId 분석 병합

**Files:**
- Create: `app/edit-log/merge.js`
- Test: `app/edit-log/merge.spec.js`

- [ ] **Step 1: 실패 테스트 작성**

`app/edit-log/merge.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import { mergeByCorrelationId } from './merge.js'

const mkEntry = (overrides) => ({
  id: 'x',
  ts: 0,
  feature: 'unknown',
  args: {},
  target: { selector: '#a', nodePath: 'a', weakRef: null },
  beforeCSS: {},
  afterCSS: {},
  source: 'mutation',
  correlationId: 'cid',
  ...overrides,
})

describe('mergeByCorrelationId', () => {
  it('returns entries unchanged when no correlation matches', () => {
    const entries = [
      mkEntry({ id: '1', correlationId: 'a' }),
      mkEntry({ id: '2', correlationId: 'b' }),
    ]
    const result = mergeByCorrelationId(entries)
    expect(result).toHaveLength(2)
  })

  it('merges entries with same correlationId', () => {
    const entries = [
      mkEntry({ id: '1', source: 'feature', feature: 'padding', correlationId: 'k', afterCSS: { 'padding-top': '4px' } }),
      mkEntry({ id: '2', source: 'mutation', correlationId: 'k', afterCSS: { 'padding-top': '4px' } }),
    ]
    const result = mergeByCorrelationId(entries)
    expect(result).toHaveLength(1)
    expect(result[0].sources).toEqual(['feature', 'mutation'])
    expect(result[0].feature).toBe('padding')
    expect(result[0].agreement).toBe(true)
  })

  it('marks agreement false when afterCSS differs', () => {
    const entries = [
      mkEntry({ id: '1', source: 'feature', correlationId: 'k', afterCSS: { 'padding-top': '4px' } }),
      mkEntry({ id: '2', source: 'mutation', correlationId: 'k', afterCSS: { 'padding-top': '8px' } }),
    ]
    const result = mergeByCorrelationId(entries)
    expect(result[0].agreement).toBe(false)
    expect(result[0].divergence).toEqual({
      'padding-top': { feature: '4px', mutation: '8px' },
    })
  })

  it('preserves order based on first occurrence', () => {
    const entries = [
      mkEntry({ id: '1', correlationId: 'a' }),
      mkEntry({ id: '2', correlationId: 'b' }),
      mkEntry({ id: '3', correlationId: 'a' }),
    ]
    const result = mergeByCorrelationId(entries)
    expect(result.map((e) => e.correlationId || e.id)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패)**

```bash
npx vitest run app/edit-log/merge.spec.js
```

- [ ] **Step 3: merge.js 구현**

`app/edit-log/merge.js`:

```js
function diffAfterCSS(a, b) {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])
  const divergence = {}
  for (const k of allKeys) {
    if (a[k] !== b[k]) {
      divergence[k] = { feature: a[k], mutation: b[k] }
    }
  }
  return divergence
}

export function mergeByCorrelationId(entries) {
  const groups = new Map()
  const order = []

  for (const e of entries) {
    if (!groups.has(e.correlationId)) {
      groups.set(e.correlationId, [])
      order.push(e.correlationId)
    }
    groups.get(e.correlationId).push(e)
  }

  return order.map((cid) => {
    const group = groups.get(cid)
    if (group.length === 1) return group[0]

    const featureEntry = group.find((e) => e.source === 'feature')
    const mutationEntry = group.find((e) => e.source === 'mutation')
    const base = featureEntry || group[0]

    const agreement = featureEntry && mutationEntry
      ? Object.keys(diffAfterCSS(featureEntry.afterCSS, mutationEntry.afterCSS)).length === 0
      : true
    const divergence = !agreement && featureEntry && mutationEntry
      ? diffAfterCSS(featureEntry.afterCSS, mutationEntry.afterCSS)
      : undefined

    return {
      ...base,
      sources: group.map((e) => e.source),
      agreement,
      ...(divergence ? { divergence } : {}),
    }
  })
}
```

- [ ] **Step 4: 테스트 통과**

```bash
npx vitest run app/edit-log/merge.spec.js
```

- [ ] **Step 5: Commit**

```bash
git add app/edit-log/merge.js app/edit-log/merge.spec.js
git commit -m "feat(edit-log): merge by correlationId with agreement/divergence"
```

---

## Task 7: formatters.js — toCSS / toScript / toJSON

**Files:**
- Create: `app/edit-log/formatters.js`
- Test: `app/edit-log/formatters.spec.js`

- [ ] **Step 1: 실패 테스트 작성**

`app/edit-log/formatters.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import { toCSS, toScript, toJSON } from './formatters.js'

const mkEntry = (overrides) => ({
  id: 'x', ts: 1, feature: 'padding', args: {},
  target: { selector: '#a', nodePath: 'a', weakRef: null },
  beforeCSS: { 'padding-top': '0px' },
  afterCSS: { 'padding-top': '4px' },
  source: 'feature', correlationId: 'k',
  ...overrides,
})

describe('toCSS', () => {
  it('groups by selector and emits changed props', () => {
    const css = toCSS([
      mkEntry({ target: { selector: '#a', nodePath: 'a' }, afterCSS: { 'padding-top': '4px' } }),
      mkEntry({ target: { selector: '#a', nodePath: 'a' }, afterCSS: { 'margin-top': '8px' } }),
    ])
    expect(css).toContain('#a {')
    expect(css).toContain('padding-top: 4px;')
    expect(css).toContain('margin-top: 8px;')
  })

  it('skips entries with no diff', () => {
    const css = toCSS([
      mkEntry({ beforeCSS: { c: '1px' }, afterCSS: { c: '1px' } }),
    ])
    expect(css.trim()).toBe('')
  })

  it('continues when single entry throws', () => {
    const bad = mkEntry({ target: null })
    const good = mkEntry({ target: { selector: '#z', nodePath: 'z' }, afterCSS: { color: 'red' } })
    const css = toCSS([bad, good])
    expect(css).toContain('#z')
  })
})

describe('toScript', () => {
  it('emits visbug feature replay calls', () => {
    const script = toScript([mkEntry({ feature: 'padding', args: ['top', 4] })])
    expect(script).toContain("visbug.replay('padding'")
  })
})

describe('toJSON', () => {
  it('returns json string with all entries', () => {
    const json = toJSON([mkEntry({ id: 'a' }), mkEntry({ id: 'b' })])
    const parsed = JSON.parse(json)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].id).toBe('a')
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패)**

```bash
npx vitest run app/edit-log/formatters.spec.js
```

- [ ] **Step 3: formatters.js 구현**

`app/edit-log/formatters.js`:

```js
function changedPropsOf(entry) {
  const before = entry.beforeCSS || {}
  const after = entry.afterCSS || {}
  const out = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const k of keys) {
    if (before[k] !== after[k] && after[k] !== undefined) out[k] = after[k]
  }
  return out
}

export function toCSS(entries, { onWarn = console.warn } = {}) {
  const bySelector = new Map()
  for (const entry of entries) {
    try {
      const sel = entry?.target?.selector
      if (!sel) continue
      const props = changedPropsOf(entry)
      if (Object.keys(props).length === 0) continue
      if (!bySelector.has(sel)) bySelector.set(sel, {})
      Object.assign(bySelector.get(sel), props)
    } catch (err) {
      onWarn('editLog: formatter skipped entry', err)
    }
  }
  const blocks = []
  for (const [sel, props] of bySelector) {
    const lines = Object.entries(props).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    blocks.push(`${sel} {\n${lines}\n}`)
  }
  return blocks.join('\n\n')
}

export function toScript(entries, { onWarn = console.warn } = {}) {
  const lines = []
  for (const entry of entries) {
    try {
      lines.push(`visbug.replay(${JSON.stringify(entry.feature)}, ${JSON.stringify(entry.args)})`)
    } catch (err) {
      onWarn('editLog: script formatter skipped entry', err)
    }
  }
  return lines.join('\n')
}

export function toJSON(entries) {
  const cleaned = entries.map((e) => ({ ...e, target: { ...e.target, weakRef: undefined } }))
  return JSON.stringify(cleaned, null, 2)
}
```

- [ ] **Step 4: 테스트 통과**

```bash
npx vitest run app/edit-log/formatters.spec.js
```

- [ ] **Step 5: Commit**

```bash
git add app/edit-log/formatters.js app/edit-log/formatters.spec.js
git commit -m "feat(edit-log): formatters (CSS/script/JSON) with per-entry resilience"
```

---

## Task 8: replay.js — verification utility

**Files:**
- Create: `app/edit-log/replay.js`
- Test: `app/edit-log/replay.spec.js`

- [ ] **Step 1: 실패 테스트 작성**

`app/edit-log/replay.spec.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { replay } from './replay.js'

const mkEntry = (overrides = {}) => ({
  id: 'x', ts: 1, feature: 'padding', args: ['#x', 4],
  target: { selector: '#x', nodePath: 'div[0]', weakRef: null },
  beforeCSS: { 'padding-top': '0px' },
  afterCSS: { 'padding-top': '4px' },
  source: 'feature', correlationId: 'k',
  ...overrides,
})

beforeEach(() => {
  document.body.innerHTML = '<div id="x"></div>'
})

describe('replay css mode', () => {
  it('applies afterCSS to target', () => {
    const result = replay(mkEntry(), { mode: 'css' })
    expect(result.ok).toBe(true)
    expect(document.getElementById('x').style.paddingTop).toBe('4px')
  })

  it('returns ok:false when target not found', () => {
    document.body.innerHTML = ''
    const result = replay(mkEntry(), { mode: 'css' })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('target-not-found')
  })

  it('warns on agreement===false', () => {
    const merged = { ...mkEntry(), agreement: false, divergence: { 'padding-top': { feature: '4px', mutation: '8px' } } }
    const result = replay(merged, { mode: 'css' })
    expect(result.ok).toBe(true)
    expect(result.warning).toBe('divergent-capture')
    expect(result.divergence).toBeDefined()
  })
})

describe('replay feature mode', () => {
  it('invokes feature function from registry', () => {
    const padding = vi.fn()
    const registry = { padding }
    const result = replay(mkEntry(), { mode: 'feature', registry })
    expect(result.ok).toBe(true)
    expect(padding).toHaveBeenCalled()
  })

  it('returns ok:false when feature missing', () => {
    const result = replay(mkEntry(), { mode: 'feature', registry: {} })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('feature-replay-failed')
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패)**

```bash
npx vitest run app/edit-log/replay.spec.js
```

- [ ] **Step 3: replay.js 구현**

`app/edit-log/replay.js`:

```js
function resolveTarget(entry) {
  const ref = entry.target?.weakRef
  if (ref) {
    const live = ref.deref()
    if (live && live.isConnected) return live
  }
  if (entry.target?.selector) {
    const found = document.querySelector(entry.target.selector)
    if (found) return found
  }
  return null
}

function applyCSS(target, afterCSS) {
  for (const [prop, value] of Object.entries(afterCSS || {})) {
    target.style.setProperty(prop, value)
  }
}

export function replay(entry, { mode = 'css', registry } = {}) {
  if (mode === 'css') {
    const target = resolveTarget(entry)
    if (!target) return { ok: false, reason: 'target-not-found' }
    try {
      applyCSS(target, entry.afterCSS)
      const out = { ok: true }
      if (entry.agreement === false) {
        out.warning = 'divergent-capture'
        out.divergence = entry.divergence
      }
      return out
    } catch (cause) {
      return { ok: false, reason: 'style-apply-failed', cause }
    }
  }

  if (mode === 'feature') {
    const fn = registry?.[entry.feature]
    if (typeof fn !== 'function') {
      return { ok: false, reason: 'feature-replay-failed', cause: new Error(`feature not in registry: ${entry.feature}`) }
    }
    try {
      fn.apply(null, entry.args || [])
      return { ok: true }
    } catch (cause) {
      return { ok: false, reason: 'feature-replay-failed', cause }
    }
  }

  return { ok: false, reason: 'unknown-mode' }
}
```

- [ ] **Step 4: 테스트 통과**

```bash
npx vitest run app/edit-log/replay.spec.js
```

- [ ] **Step 5: Commit**

```bash
git add app/edit-log/replay.js app/edit-log/replay.spec.js
git commit -m "feat(edit-log): replay (css/feature mode) for verification"
```

---

## Task 9: index.js — install(host) 통합

**Files:**
- Create: `app/edit-log/index.js`

- [ ] **Step 1: install 함수 구현**

`app/edit-log/index.js`:

```js
import { createDispatcher } from './dispatcher.js'
import { createMutationWatcher } from './mutation-watcher.js'
import { wrapFeature } from './feature-wrapper.js'
import { mergeByCorrelationId } from './merge.js'
import { toCSS, toScript, toJSON } from './formatters.js'
import { replay } from './replay.js'

const FEATURE_PROP_MAP = {
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  font: ['font-size', 'font-family', 'font-weight', 'line-height', 'color'],
  text: ['color'],
  move: ['top', 'right', 'bottom', 'left', 'transform'],
  flex: ['display', 'flex-direction', 'justify-content', 'align-items', 'gap'],
  position: ['position', 'top', 'right', 'bottom', 'left'],
  boxshadow: ['box-shadow'],
  hueshift: ['color', 'background-color'],
  imageswap: ['src'],
  color: ['color', 'background-color'],
}

export function installEditLog(host, opts = {}) {
  const dispatcher = createDispatcher({ maxSize: opts.bufferSize, onWarn: opts.onWarn })
  const watcher = createMutationWatcher({
    root: document,
    dispatcher,
    onWarn: opts.onWarn,
  })

  let onEditLogFn = null
  dispatcher.subscribe((entry) => {
    host.dispatchEvent(new CustomEvent('editlog', { detail: entry, bubbles: true, composed: true }))
    if (typeof onEditLogFn === 'function') {
      try { onEditLogFn(entry) } catch (err) { (opts.onWarn || console.warn)('editLog: onEditLog setter threw', err) }
    }
  })

  watcher.start()

  Object.defineProperty(host, 'onEditLog', {
    configurable: true,
    set(fn) { onEditLogFn = fn },
    get() { return onEditLogFn },
  })

  host.getHistory = (options = {}) => {
    const raw = dispatcher.getAll()
    if (options.merge === 'correlated') return mergeByCorrelationId(raw)
    if (options.merge === 'analyzed' && typeof options.policy === 'function') return options.policy(raw)
    return raw
  }

  host.clearHistory = () => dispatcher.clear()

  host.replay = (entry, replayOpts) => replay(entry, replayOpts)

  host.editLogStream = () => {
    const queue = []
    const resolvers = []
    const unsub = dispatcher.subscribe((entry) => {
      if (resolvers.length) resolvers.shift()({ value: entry, done: false })
      else queue.push(entry)
    })
    return {
      [Symbol.asyncIterator]() {
        return {
          next: () => queue.length
            ? Promise.resolve({ value: queue.shift(), done: false })
            : new Promise((resolve) => resolvers.push(resolve)),
          return: () => { unsub(); return Promise.resolve({ value: undefined, done: true }) },
        }
      },
    }
  }

  host._editLogFormatters = { toCSS, toScript, toJSON }

  return {
    wrapFeatureFn: (featureName, original, resolveTarget) =>
      wrapFeature({
        featureName,
        original,
        dispatcher,
        resolveTarget,
        props: FEATURE_PROP_MAP[featureName] || [],
        onWarn: opts.onWarn,
      }),
    teardown: () => {
      watcher.stop()
      dispatcher.clear()
      delete host.onEditLog
      delete host.getHistory
      delete host.clearHistory
      delete host.replay
      delete host.editLogStream
      delete host._editLogFormatters
    },
  }
}

export { mergeByCorrelationId, toCSS, toScript, toJSON, replay }
```

- [ ] **Step 2: 빌드 smoke (rollup이 새 모듈을 잘 묶는지)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx rollup -c
grep -q "installEditLog" app/bundle.js || echo "WARN: installEditLog not in bundle yet (vis-bug.element 변경 전이라 정상)"
```

Expected: rollup 빌드 성공. installEditLog는 vis-bug.element가 import 안 했으므로 tree-shake로 빠질 수 있음 — 정상.

- [ ] **Step 3: Commit**

```bash
git add app/edit-log/index.js
git commit -m "feat(edit-log): install(host) wires dispatcher + watcher + APIs"
```

---

## Task 10: vis-bug.element.js에 install 통합

**Files:**
- Modify: `app/components/vis-bug/vis-bug.element.js`

- [ ] **Step 1: import 추가 + connectedCallback 후크**

`app/components/vis-bug/vis-bug.element.js` 상단 import 블록 끝에 추가:

```js
import { installEditLog } from '../../edit-log/index.js'
```

`connectedCallback() { ... }` 메서드 시작 부분(this._tutsBaseURL 라인 위)에 다음 추가:

```js
    this._editLog = installEditLog(this, {
      bufferSize: 1000,
      onWarn: (...args) => console.warn('[vis-bug edit-log]', ...args),
    })
```

`disconnectedCallback() { ... }` 메서드가 없다면 다음을 클래스에 추가 (constructor 뒤, observedAttributes 앞):

```js
  disconnectedCallback() {
    this._editLog?.teardown()
  }
```

이미 `disconnectedCallback`이 있다면 첫 줄에 `this._editLog?.teardown()` 추가.

- [ ] **Step 2: 빌드 + 빌드 산출물에 installEditLog 포함 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx rollup -c
grep -q "installEditLog\|edit-log" app/bundle.js && echo "OK: installEditLog bundled"
```

Expected: OK 메시지 출력.

- [ ] **Step 3: Commit**

```bash
git add app/components/vis-bug/vis-bug.element.js
git commit -m "feat(vis-bug): install edit-log on connectedCallback + teardown on disconnect"
```

---

## Task 11: feature wrapping 통합 (padding/margin부터)

**Files:**
- Modify: `app/components/vis-bug/vis-bug.element.js`

- [ ] **Step 1: 결정 — wrapping 위치**

visbug features는 `Padding(host)`, `Margin(host)` 등 팩토리로 host에 부착됨. wrapping은 두 옵션:
- (a) 각 feature 모듈에서 export 직전 wrap (vendor 침습 큼)
- (b) `<vis-bug>` connectedCallback에서 host method를 wrap (침습 작음, 추천)

여기서는 (b) 채택.

`connectedCallback` 내, `installEditLog` 바로 다음에 다음 추가 (예시 — 실제 host method 이름은 features/*.js 코드 확인 필요):

```js
    // padding feature wrapping
    if (typeof this.applyPaddingDelta === 'function') {
      const orig = this.applyPaddingDelta.bind(this)
      this.applyPaddingDelta = this._editLog.wrapFeatureFn(
        'padding',
        orig,
        (args) => this.selectorEngine?.selection()?.[0] || null,
      )
    }
```

**중요**: `applyPaddingDelta`는 placeholder. 실제 padding feature가 어떤 host method를 호출하는지 `app/features/padding.js`를 읽고 확인 후 그 이름으로 교체. 다른 feature(margin/font/text/move/flex/position/boxshadow)도 같은 패턴.

- [ ] **Step 2: app/features/padding.js 읽고 실제 method 이름 확인**

```bash
cat app/features/padding.js | head -80
```

확인 후 Step 1의 `applyPaddingDelta`를 실제 이름으로 교체.

- [ ] **Step 3: 11개 wrapping 라인 추가**

각 feature(padding, margin, font, text, move, flex, position, boxshadow, hueshift, imageswap, color)에 대해 같은 패턴 반복. 단, feature가 wrap 가능한 host method를 노출하지 않는 경우(feature 내부 closure만 있는 경우) 그 feature는 skip하고 README/comment에 이유 기록 + MutationObserver baseline에 의존.

- [ ] **Step 4: 빌드 + 단위 테스트 전체**

```bash
npx rollup -c
npx vitest run app/edit-log/
```

Expected: 빌드 성공. 단위 테스트 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/vis-bug/vis-bug.element.js
git commit -m "feat(vis-bug): wrap feature methods to emit edit-log entries"
```

---

## Task 12: integration.test.js — playwright e2e

**Files:**
- Create: `app/edit-log/integration.test.js`

- [ ] **Step 1: e2e 테스트 작성**

`app/edit-log/integration.test.js`:

```js
import { test, expect, changeMode } from '../../tests/helpers.js'

test('padding edit dispatches editlog CustomEvent', async ({ visbugPage }) => {
  await changeMode({ tool: 'padding', page: visbugPage })

  const eventPromise = visbugPage.evaluate(() => new Promise((resolve) => {
    document.querySelector('vis-bug').addEventListener('editlog', (e) => resolve(e.detail), { once: true })
  }))

  await visbugPage.click('[intro] b')
  await visbugPage.keyboard.press('ArrowUp')

  const detail = await eventPromise
  expect(detail.feature === 'padding' || detail.source === 'mutation').toBe(true)
  expect(detail.target).toBeDefined()
  expect(detail.afterCSS).toBeDefined()
})

test('getHistory returns entries after edits', async ({ visbugPage }) => {
  await changeMode({ tool: 'padding', page: visbugPage })
  await visbugPage.click('[intro] b')
  await visbugPage.keyboard.press('ArrowUp')
  await visbugPage.keyboard.press('ArrowUp')

  const count = await visbugPage.$eval('vis-bug', (el) => el.getHistory().length)
  expect(count).toBeGreaterThanOrEqual(2)
})

test('onEditLog setter receives entries', async ({ visbugPage }) => {
  await changeMode({ tool: 'padding', page: visbugPage })

  await visbugPage.evaluate(() => {
    window.__entries = []
    document.querySelector('vis-bug').onEditLog = (e) => window.__entries.push(e)
  })

  await visbugPage.click('[intro] b')
  await visbugPage.keyboard.press('ArrowUp')

  const len = await visbugPage.evaluate(() => window.__entries.length)
  expect(len).toBeGreaterThan(0)
})

test('clearHistory empties buffer', async ({ visbugPage }) => {
  await changeMode({ tool: 'padding', page: visbugPage })
  await visbugPage.click('[intro] b')
  await visbugPage.keyboard.press('ArrowUp')

  await visbugPage.$eval('vis-bug', (el) => el.clearHistory())
  const count = await visbugPage.$eval('vis-bug', (el) => el.getHistory().length)
  expect(count).toBe(0)
})
```

- [ ] **Step 2: e2e 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npx playwright test app/edit-log/integration.test.js
```

Expected: 4 tests PASS. 실패 시:
- editlog 이벤트 안 옴 → install 호출 위치 확인 (connectedCallback 진입 전 dispatch 못 함)
- onEditLog setter 안 먹음 → defineProperty 적용 확인
- getHistory undefined → install이 host에 메서드 부착 못 함

- [ ] **Step 3: Commit**

```bash
git add app/edit-log/integration.test.js
git commit -m "test(edit-log): playwright e2e for CustomEvent/setter/getHistory/clear"
```

---

## Task 13: 통합 검증

- [ ] **Step 1: 모든 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/vendor/projectvisbug
npm run test:unit
npx playwright test
```

Expected:
- vitest: edit-log 모든 spec PASS (entry/dispatcher/mutation-watcher/feature-wrapper/merge/formatters/replay)
- playwright: 12 기존 feature 테스트 + edit-log integration 4 테스트 모두 PASS

- [ ] **Step 2: 빌드 + 산출물 검증**

```bash
npm run bundle
node -e "import('./app/bundle.js').then(() => console.log('bundle loadable'))"
```

Expected: bundle 빌드 + 모듈로 로드 성공.

- [ ] **Step 3: monorepo submodule pointer 갱신**

```bash
cd /Users/junwoobang/workflow/qa-sdk
git add vendor/projectvisbug
git commit -m "chore(vendor): bump projectvisbug to phase-b2-edit-log HEAD"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ entry.js (snapshot/diff/correlationId/createEntry)
- ✅ dispatcher.js (ring buffer, subscribe with error isolation)
- ✅ mutation-watcher.js (style/class/subtree)
- ✅ feature-wrapper.js (pre/post capture, rethrow)
- ✅ merge.js (correlationId 그룹핑, agreement/divergence)
- ✅ formatters.js (CSS/script/JSON, per-entry skip)
- ✅ replay.js (css/feature mode, target-not-found, agreement warning)
- ✅ index.js (install + asyncIterator + 모든 인스턴스 API)
- ✅ vis-bug.element 통합 (connectedCallback install + disconnect teardown)
- ✅ feature wrapping 패턴 (B'2 spec components 표 모든 모듈)

**잠재 리스크:**
- Task 11에서 features/*.js의 host method 이름이 예상과 다를 수 있음 → 실제 코드 확인 후 wrap 대상 결정. wrap 불가 feature는 MutationObserver baseline로 fallback (이미 구현됨)
- jsdom의 `getComputedStyle`이 실제 브라우저보다 제한적일 수 있음 — vitest 단위 테스트는 sanity 수준, 실제 검증은 playwright e2e
- WeakRef.deref() 동작은 GC 의존 — replay css mode는 selector fallback이 우선, weakRef는 보조

**의도적 미구현 (B'3 또는 후속):**
- history panel UI
- visbug-bridge 패키지
- localStorage 영속화
