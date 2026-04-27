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
