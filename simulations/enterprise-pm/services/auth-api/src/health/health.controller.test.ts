import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('sim-auth-api HealthController', () => {
  it('status=ok + service=sim-auth-api 반환', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('sim-auth-api');
  });

  it('ownedPrefixes는 design.md §2 (sim.user/role/dept/bitmap)', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ownedPrefixes).toEqual(['sim.user', 'sim.role', 'sim.dept', 'sim.bitmap']);
  });

  it('ts는 ISO-8601 문자열', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('otelStatus 필드 포함 (ok|noop) — Plan 12c', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.otelStatus).toMatch(/^(ok|noop)$/);
  });
});
