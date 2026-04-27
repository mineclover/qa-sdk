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
