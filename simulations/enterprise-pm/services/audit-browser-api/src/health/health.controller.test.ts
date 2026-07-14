import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('sim-audit-browser-api HealthController', () => {
  it('status=ok + service=sim-audit-browser-api 반환', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('sim-audit-browser-api');
  });

  it('view-only — ownedPrefixes 빈 배열, reads=audit-recorder-store', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ownedPrefixes).toEqual([]);
    expect(res.role).toBe('read-aggregate');
    expect(res.reads).toEqual(['audit-recorder-store']);
  });

  it('ts는 ISO-8601 문자열', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
