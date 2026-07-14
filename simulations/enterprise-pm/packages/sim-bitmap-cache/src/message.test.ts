// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from 'vitest';
import {
  invalidationMessageSchema,
  serializeMessage,
  parseMessage,
  type InvalidationMessage,
} from './message.js';

const sample: InvalidationMessage = {
  scope: 'user',
  target: 'user-1',
  reason: 'permission_change',
  issuedAt: '2026-04-22T00:00:00.000Z',
  publisher: 'sim-auth-api',
};

describe('InvalidationMessage 스키마 — §5 정확 매칭', () => {
  it('scope 3 enum: user / role / prefix', () => {
    const u = invalidationMessageSchema.safeParse({ ...sample, scope: 'user' });
    const r = invalidationMessageSchema.safeParse({ ...sample, scope: 'role' });
    const p = invalidationMessageSchema.safeParse({ ...sample, scope: 'prefix' });
    expect(u.success && r.success && p.success).toBe(true);
    const bad = invalidationMessageSchema.safeParse({ ...sample, scope: 'session' });
    expect(bad.success).toBe(false);
  });

  it('reason 4 enum: permission_change / role_redefinition / prefix_version_bump / security_incident', () => {
    for (const reason of [
      'permission_change',
      'role_redefinition',
      'prefix_version_bump',
      'security_incident',
    ] as const) {
      const r = invalidationMessageSchema.safeParse({ ...sample, reason });
      expect(r.success, reason).toBe(true);
    }
    const bad = invalidationMessageSchema.safeParse({ ...sample, reason: 'manual' });
    expect(bad.success).toBe(false);
  });

  it('affectedUserIds 옵션 — role/prefix scope에서 활용', () => {
    const ok = invalidationMessageSchema.safeParse({
      ...sample,
      scope: 'role',
      target: 'role-1',
      affectedUserIds: ['u1', 'u2'],
    });
    expect(ok.success).toBe(true);
  });

  it('serialize/parse round-trip', () => {
    const json = serializeMessage(sample);
    expect(typeof json).toBe('string');
    const back = parseMessage(json);
    expect(back).toEqual(sample);
  });

  it('invalid JSON → throw', () => {
    expect(() => parseMessage('not-json')).toThrow();
  });

  it('schema invalid → parse throw with zod issues', () => {
    const partial = JSON.stringify({ scope: 'user' });
    expect(() => parseMessage(partial)).toThrow();
  });
});
