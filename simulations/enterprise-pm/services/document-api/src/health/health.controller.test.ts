import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('sim-document-api HealthController', () => {
  it('status=ok + service=sim-document-api 반환', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('sim-document-api');
  });

  it('ownedPrefixes는 design.md §2 (sim.doc/comment/attachment)', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ownedPrefixes).toEqual(['sim.doc', 'sim.comment', 'sim.attachment']);
    expect(res.role).toBe('producer');
  });

  it('ts는 ISO-8601 문자열', () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
