import { describe, expect, it } from 'vitest';
import { measureCase } from './measure.js';

describe('measureCase', () => {
  it('정상 case는 ok와 nsPerOp를 기록한다', () => {
    const r = measureCase({ id: 'noop', warm: true, iterations: 200, run: () => 1 + 1 });
    expect(r.status).toBe('ok');
    expect(r.nsPerOp?.p50).toBeGreaterThanOrEqual(0);
    expect(r.iterations).toBe(200);
  });

  it('gc가 노출되지 않으면 heapDeltaBytesPerOp는 null', () => {
    const r = measureCase({ id: 'noop', warm: true, iterations: 200, run: () => ({}) });
    if (typeof globalThis.gc !== 'function') expect(r.heapDeltaBytesPerOp).toBeNull();
  });

  it('예외가 나면 skipped로 기록하고 이유를 보존한다', () => {
    const r = measureCase({
      id: 'boom',
      warm: true,
      iterations: 10,
      run: () => {
        throw new Error('Unknown axis version');
      },
    });
    expect(r).toMatchObject({
      status: 'skipped',
      skipReason: expect.stringContaining('Unknown axis version'),
      nsPerOp: null,
    });
  });

  it('cold 측정은 warm=false로 따로 기록한다', () => {
    expect(measureCase({ id: 'x', warm: false, iterations: 1, run: () => 0 }).warm).toBe(false);
  });

  it('표본이 100 미만이면 p99는 null', () => {
    const r = measureCase({ id: 'few', warm: false, iterations: 50, run: () => 0 });
    expect(r.nsPerOp?.p99).toBeNull();
  });

  it('iterations가 1 미만이면 거부한다', () => {
    expect(() => measureCase({ id: 'zero', warm: true, iterations: 0, run: () => 0 })).toThrow();
  });
});
