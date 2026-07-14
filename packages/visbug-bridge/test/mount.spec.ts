import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '';
  // visbug 실제 모듈은 jsdom 환경에서 일부 API 미지원이므로 customElements를 미리 등록한 stub 활용
  if (!customElements.get('vis-bug')) {
    class VisBugStub extends HTMLElement {
      _history: unknown[] = [];
      onEditLog: ((e: unknown) => void) | null = null;
      getHistory() {
        return this._history;
      }
      clearHistory() {
        this._history = [];
      }
      replay() {
        return { ok: true };
      }
      editLogStream() {
        return {
          [Symbol.asyncIterator]() {
            return { next: () => Promise.resolve({ value: undefined, done: true }) };
          },
        };
      }
    }
    customElements.define('vis-bug', VisBugStub);
  }
});

describe('mountVisBug', () => {
  it('throws when host element is missing', async () => {
    const { mountVisBug } = await import('../src/mount.js');
    expect(() => mountVisBug(null as any, {})).toThrow();
  });

  it('appends <vis-bug> to host and returns controller', async () => {
    const { mountVisBug } = await import('../src/mount.js');
    const ctrl = mountVisBug(document.body, {});
    expect(document.body.querySelector('vis-bug')).toBeTruthy();
    expect(typeof ctrl.unmount).toBe('function');
    ctrl.unmount();
    expect(document.body.querySelector('vis-bug')).toBeNull();
  });

  it('wires onEntry callback via onEditLog setter', async () => {
    const { mountVisBug } = await import('../src/mount.js');
    const onEntry = vi.fn();
    const ctrl = mountVisBug(document.body, { onEntry });
    const visbug: any = document.body.querySelector('vis-bug');
    visbug.onEditLog?.({ id: 'e1', source: 'feature' });
    expect(onEntry).toHaveBeenCalledWith({ id: 'e1', source: 'feature' });
    ctrl.unmount();
  });

  it('isolates onEntry throw via logger.warn', async () => {
    const { mountVisBug } = await import('../src/mount.js');
    const warn = vi.fn();
    const onEntry = () => {
      throw new Error('boom');
    };
    const ctrl = mountVisBug(document.body, { onEntry, logger: { warn } });
    const visbug: any = document.body.querySelector('vis-bug');
    visbug.onEditLog?.({ id: 'e1', source: 'feature' });
    expect(warn).toHaveBeenCalled();
    ctrl.unmount();
  });

  it('entryFilter feature skips mutation entries by default wiring', async () => {
    const { mountVisBug } = await import('../src/mount.js');
    const onEntry = vi.fn();
    const ctrl = mountVisBug(document.body, { onEntry });
    const visbug: any = document.body.querySelector('vis-bug');
    visbug.onEditLog?.({ id: 'm1', source: 'mutation' });
    visbug.onEditLog?.({ id: 'f1', source: 'feature' });
    expect(onEntry).toHaveBeenCalledTimes(1);
    expect(onEntry).toHaveBeenCalledWith({ id: 'f1', source: 'feature' });
    ctrl.unmount();
  });

  it('entryFilter all forwards mutation entries', async () => {
    const { mountVisBug } = await import('../src/mount.js');
    const onEntry = vi.fn();
    const ctrl = mountVisBug(document.body, { onEntry, entryFilter: 'all' });
    const visbug: any = document.body.querySelector('vis-bug');
    visbug.onEditLog?.({ id: 'm1', source: 'mutation' });
    expect(onEntry).toHaveBeenCalledTimes(1);
    ctrl.unmount();
  });

  it('sets resolveDomRefSymbols on <vis-bug> before mount', async () => {
    const { mountVisBug } = await import('../src/mount.js');
    const resolveDomRefSymbols = vi.fn(() => [
      { kind: 'rlsc' as const, value: 'rlsc:button:save', matchCount: 1, stability: 90 },
    ]);
    const ctrl = mountVisBug(document.body, { resolveDomRefSymbols });
    const visbug: any = document.body.querySelector('vis-bug');
    expect(visbug.resolveDomRefSymbols).toBe(resolveDomRefSymbols);
    ctrl.unmount();
  });
});
