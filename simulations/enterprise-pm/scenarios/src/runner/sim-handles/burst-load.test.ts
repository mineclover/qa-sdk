// @def.boundary sim-scenarios

import { describe, expect, it } from 'vitest';
import { createBurstLoad, type FetchLike } from './burst-load.js';

describe('burst-load handle', () => {
  it('rps 100으로 setInterval 호출 후 stop()시 fetch 발사 + interval clear', async () => {
    let fired = 0;
    const fetchImpl: FetchLike = async () => {
      fired += 1;
      return { ok: true, status: 200 };
    };

    let intervalCb: (() => void) | null = null;
    let cleared = false;
    const setIntervalImpl = (cb: () => void) => {
      intervalCb = cb;
      return Symbol('handle');
    };
    const clearIntervalImpl = () => {
      cleared = true;
    };

    const burst = createBurstLoad({
      targetUrl: 'http://x/healthz',
      fetchImpl,
      setIntervalImpl,
      clearIntervalImpl,
    });
    const handle = await burst(100);
    expect(intervalCb).not.toBeNull();
    // tick 3회 시뮬.
    intervalCb!();
    intervalCb!();
    intervalCb!();
    // in-flight 요청 settle 대기.
    await handle.stop();
    expect(cleared).toBe(true);
    expect(fired).toBe(3);
  });

  it('rps invalid → throw', async () => {
    const burst = createBurstLoad({ targetUrl: 'http://x' });
    await expect(burst(0)).rejects.toThrow(/positive number/);
    await expect(burst(-5)).rejects.toThrow(/positive number/);
    await expect(burst(Number.NaN)).rejects.toThrow(/positive number/);
  });

  it('fetch reject되어도 stop() 정상 settle', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('network');
    };
    let intervalCb: (() => void) | null = null;
    const burst = createBurstLoad({
      targetUrl: 'http://x',
      fetchImpl,
      setIntervalImpl: (cb) => {
        intervalCb = cb;
        return Symbol('h');
      },
      clearIntervalImpl: () => {},
    });
    const h = await burst(50);
    intervalCb!();
    await expect(h.stop()).resolves.toBeUndefined();
  });

  it('rps가 매우 크면 batchPerTick으로 1 tick에 다회 발사', async () => {
    let fired = 0;
    const fetchImpl: FetchLike = async () => {
      fired += 1;
      return { ok: true, status: 200 };
    };
    let intervalCb: (() => void) | null = null;
    const burst = createBurstLoad({
      targetUrl: 'http://x',
      fetchImpl,
      setIntervalImpl: (cb) => {
        intervalCb = cb;
        return Symbol('h');
      },
      clearIntervalImpl: () => {},
    });
    const h = await burst(5000);
    intervalCb!();
    await h.stop();
    expect(fired).toBeGreaterThanOrEqual(2);
  });
});
