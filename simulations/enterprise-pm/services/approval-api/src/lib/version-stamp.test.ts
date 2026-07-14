// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

describe('ServiceVersionStamp helper', () => {
  beforeAll(() => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    process.env.SIM_DB_WRITE_URL = 'postgres://x:y@h/y';
    process.env.SIM_DB_READ_URL = 'postgres://x:y@h/y';
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('withServiceVersion injects current version', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    vi.resetModules();
    const { withServiceVersion, SERVICE_VERSION } = await import('./service-version.js');
    expect(SERVICE_VERSION).toBe('v3');
    expect(withServiceVersion({ id: 'x' })).toEqual({
      id: 'x',
      serviceVersion: 'v3',
    });
  });

  it('withServiceVersion preserves nested fields', async () => {
    process.env.SIM_SERVICE_VERSION = 'v4-candidate';
    vi.resetModules();
    const { withServiceVersion } = await import('./service-version.js');
    const out = withServiceVersion({ a: 1, nested: { b: 2 } });
    expect(out).toEqual({
      a: 1,
      nested: { b: 2 },
      serviceVersion: 'v4-candidate',
    });
  });

  it('env schema rejects unknown SIM_SERVICE_VERSION (fail-closed)', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3'; // 모듈 로드 통과용
    vi.resetModules();
    const mod = await import('../config/env.js');
    expect(() => mod.parseEnv({ ...process.env, SIM_SERVICE_VERSION: 'unknown' })).toThrow(
      /grammar #3/,
    );
  });

  it('env schema accepts grammar #3 forms', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    vi.resetModules();
    const mod = await import('../config/env.js');
    expect(() => mod.parseEnv({ ...process.env, SIM_SERVICE_VERSION: 'v3' })).not.toThrow();
    expect(() => mod.parseEnv({ ...process.env, SIM_SERVICE_VERSION: 'v4-stable' })).not.toThrow();
    expect(() =>
      mod.parseEnv({ ...process.env, SIM_SERVICE_VERSION: 'v4-candidate' }),
    ).not.toThrow();
  });
});
