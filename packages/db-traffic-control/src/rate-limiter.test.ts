import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('maxQps까지 허용', () => {
    const limiter = new RateLimiter();
    limiter.register('test', 3);

    const now = 1000;
    expect(limiter.tryConsume('test', now)).toBe(true);
    expect(limiter.tryConsume('test', now + 1)).toBe(true);
    expect(limiter.tryConsume('test', now + 2)).toBe(true);
    expect(limiter.tryConsume('test', now + 3)).toBe(false); // 4번째 거부
  });

  it('1초 후 윈도우 갱신되면 다시 허용', () => {
    const limiter = new RateLimiter();
    limiter.register('test', 2);

    const t0 = 10_000;
    expect(limiter.tryConsume('test', t0)).toBe(true);
    expect(limiter.tryConsume('test', t0 + 50)).toBe(true);
    expect(limiter.tryConsume('test', t0 + 100)).toBe(false);

    // 1초 후
    expect(limiter.tryConsume('test', t0 + 1100)).toBe(true);
  });

  it('getCurrentQps는 소비하지 않음', () => {
    const limiter = new RateLimiter();
    limiter.register('test', 10);

    const now = 5000;
    limiter.tryConsume('test', now);
    limiter.tryConsume('test', now + 10);

    expect(limiter.getCurrentQps('test', now + 20)).toBe(2);
    expect(limiter.getCurrentQps('test', now + 30)).toBe(2); // 변하지 않음
  });

  it('미등록 budget은 항상 허용', () => {
    const limiter = new RateLimiter();
    expect(limiter.tryConsume('unknown')).toBe(true);
    expect(limiter.getCurrentQps('unknown')).toBe(0);
  });

  it('snapshot으로 전체 상태 조회', () => {
    const limiter = new RateLimiter();
    limiter.register('a', 100);
    limiter.register('b', 50);

    const now = 20_000;
    limiter.tryConsume('a', now);
    limiter.tryConsume('a', now + 10);
    limiter.tryConsume('b', now + 20);

    const snap = limiter.snapshot(now + 30);
    expect(snap['a']).toEqual({ currentQps: 2, maxQps: 100 });
    expect(snap['b']).toEqual({ currentQps: 1, maxQps: 50 });
  });

  it('getStatus 조회', () => {
    const limiter = new RateLimiter();
    limiter.register('test', 100);

    const now = 30_000;
    limiter.tryConsume('test', now);

    const status = limiter.getStatus('test', now + 10);
    expect(status).toEqual({ currentQps: 1, maxQps: 100 });
  });

  it('미등록 getStatus는 undefined', () => {
    const limiter = new RateLimiter();
    expect(limiter.getStatus('unknown')).toBeUndefined();
  });

  it('unregister로 정리', () => {
    const limiter = new RateLimiter();
    limiter.register('test', 100);
    limiter.tryConsume('test');
    limiter.unregister('test');
    expect(limiter.getStatus('test')).toBeUndefined();
  });
});
