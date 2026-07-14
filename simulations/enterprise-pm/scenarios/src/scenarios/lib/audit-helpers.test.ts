import { describe, expect, it, vi } from 'vitest';
import { fetchAuditTrace, fetchFirstFailure, fetchAuditEntry } from './audit-helpers.js';

describe('audit-helpers', () => {
  it('fetchAuditTrace — 200 → 응답 deserialize', async () => {
    const gw = vi.fn(async (req: Request) => {
      expect(req.url).toContain('/audit/trace/root-1');
      expect(req.headers.get('authorization')).toBe('Bearer t');
      return Response.json({ rootSpanId: 'root-1', count: 2, entries: [] });
    });
    const res = await fetchAuditTrace(gw, 'root-1', 't');
    expect(res.count).toBe(2);
  });

  it('fetchFirstFailure — null 응답', async () => {
    const gw = vi.fn(async () => Response.json({ rootSpanId: 'r', firstFailure: null }));
    const res = await fetchFirstFailure(gw, 'r', 't');
    expect(res.firstFailure).toBeNull();
  });

  it('fetchAuditEntry — 404 → throw', async () => {
    const gw = vi.fn(async () => new Response('nope', { status: 404 }));
    await expect(fetchAuditEntry(gw, 'missing', 't')).rejects.toThrow();
  });
});
