// scripts/break-glass-shared/audit-recorder-client.test.ts
// Plan E Stage 12 Task 12.3 — operator-identity + audit-recorder client 단위 테스트.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordOperatorAction } from './audit-recorder-client.js';
import { resolveOperatorIdentity } from './operator-identity.js';

describe('operator-identity', () => {
  beforeEach(() => {
    delete process.env.SIM_OPERATOR_ACTOR;
  });

  it('env가 있으면 env 우선', () => {
    process.env.SIM_OPERATOR_ACTOR = 'ops@example.com';
    expect(resolveOperatorIdentity()).toBe('ops@example.com');
  });

  it('env 없으면 fallback (non-empty)', () => {
    expect(resolveOperatorIdentity().length).toBeGreaterThan(0);
  });
});

describe('recordOperatorAction', () => {
  it('operatorAction:true + evidence break-glass-cli source', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await recordOperatorAction('http://audit:5100', {
      decisionId: 'safety-decision-01HVZABCDEFGHJKMNPQRSTVWXY',
      operatorAction: true,
      actor: 'ops@example.com',
      command: 'sim-canary abort',
      service: 'approval-api',
      reason: 'schemaCompatRate spike',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://audit:5100/operator-actions');
    const body = JSON.parse(init.body as string);
    expect(body.operatorAction).toBe(true);
    expect(body.evidence[0]).toMatchObject({
      kind: 'external',
      source: 'break-glass-cli',
    });
    vi.unstubAllGlobals();
  });

  it('audit write 실패 시 throw (retry 없음)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      recordOperatorAction('http://audit:5100', {
        decisionId: 'resource-decision-01HVZABCDEFGHJKMNPQRSTVWXY',
        operatorAction: true,
        actor: 'ops',
        command: 'sim-scale set --pin',
        service: 'approval-api-v2',
        reason: 'manual',
      }),
    ).rejects.toThrow(/audit-recorder write failed: 500/);
    vi.unstubAllGlobals();
  });
});
