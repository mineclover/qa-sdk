import { describe, expect, it } from 'vitest';
import { ConcurrencyLimiter } from './concurrency-limiter.js';

describe('ConcurrencyLimiter', () => {
  it('등록 후 max까지 획득 가능', () => {
    const limiter = new ConcurrencyLimiter();
    limiter.register('test', 2);

    const r1 = limiter.tryAcquire('test');
    const r2 = limiter.tryAcquire('test');
    const r3 = limiter.tryAcquire('test');

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r3).toBeNull(); // 3번째는 실패

    expect(limiter.getStatus('test')).toEqual({ current: 2, max: 2 });
  });

  it('release 후 재획득 가능', () => {
    const limiter = new ConcurrencyLimiter();
    limiter.register('test', 1);

    const r1 = limiter.tryAcquire('test')!;
    expect(limiter.tryAcquire('test')).toBeNull();

    r1(); // release
    expect(limiter.getStatus('test')).toEqual({ current: 0, max: 1 });

    const r2 = limiter.tryAcquire('test');
    expect(r2).not.toBeNull();
  });

  it('이중 release는 무시', () => {
    const limiter = new ConcurrencyLimiter();
    limiter.register('test', 1);

    const release = limiter.tryAcquire('test')!;
    release();
    release(); // 이중 호출

    expect(limiter.getStatus('test')).toEqual({ current: 0, max: 1 });
  });

  it('미등록 budget은 항상 성공 (noop release)', () => {
    const limiter = new ConcurrencyLimiter();
    const release = limiter.tryAcquire('unknown');
    expect(release).not.toBeNull();
    release!(); // noop
  });

  it('acquire는 슬롯 해제 시 대기 후 획득', async () => {
    const limiter = new ConcurrencyLimiter();
    limiter.register('test', 1);

    const release1 = limiter.tryAcquire('test')!;

    // 비동기 대기
    const acquirePromise = limiter.acquire('test', 1000);

    // 잠시 후 release
    setTimeout(() => release1(), 10);

    const release2 = await acquirePromise;
    expect(limiter.getStatus('test')).toEqual({ current: 1, max: 1 });
    release2();
    expect(limiter.getStatus('test')).toEqual({ current: 0, max: 1 });
  });

  it('acquire timeout 시 reject', async () => {
    const limiter = new ConcurrencyLimiter();
    limiter.register('test', 1);
    limiter.tryAcquire('test'); // 슬롯 점유

    await expect(limiter.acquire('test', 50)).rejects.toThrow('timeout');
  });

  it('snapshot으로 전체 상태 조회', () => {
    const limiter = new ConcurrencyLimiter();
    limiter.register('a', 5);
    limiter.register('b', 10);
    limiter.tryAcquire('a');
    limiter.tryAcquire('a');
    limiter.tryAcquire('b');

    const snap = limiter.snapshot();
    expect(snap['a']).toEqual({ current: 2, max: 5 });
    expect(snap['b']).toEqual({ current: 1, max: 10 });
  });

  it('unregister로 정리', () => {
    const limiter = new ConcurrencyLimiter();
    limiter.register('test', 5);
    limiter.tryAcquire('test');
    limiter.unregister('test');
    expect(limiter.getStatus('test')).toBeUndefined();
  });
});
