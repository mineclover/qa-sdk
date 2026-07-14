import { describe, it, expect, vi, afterEach } from 'vitest';
import { httpProbe } from '../../src/verify/health-check.js';

// fetch를 모킹
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('httpProbe', () => {
  afterEach(() => vi.restoreAllMocks());

  it('200 → pass', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await httpProbe('http://localhost:3200/health');
    expect(result.verdict).toBe('pass');
  });

  it('500 → fail', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await httpProbe('http://localhost:3200/health');
    expect(result.verdict).toBe('fail');
  });

  it('네트워크 에러 → fail', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await httpProbe('http://localhost:3200/health');
    expect(result.verdict).toBe('fail');
    expect(result.detail).toContain('ECONNREFUSED');
  });
});
