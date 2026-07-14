import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('sim-reporting-api HealthController', () => {
  it('status=ok + service=sim-reporting-api 반환', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('sim-reporting-api');
  });

  it('ownedPrefixes는 design.md §2 (sim.report/metric)', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ownedPrefixes).toEqual(['sim.report', 'sim.metric']);
    expect(res.role).toBe('read-aggregate');
  });

  it('ts는 ISO-8601 문자열', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
