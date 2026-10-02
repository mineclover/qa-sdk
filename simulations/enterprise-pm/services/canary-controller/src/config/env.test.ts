import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const BASE_ENV = {
  SIM_DB_WRITE_URL: 'postgres://test@localhost:5432/test',
  SIM_METRICS_COLLECTOR_URL: 'http://localhost:5200',
  QA_INGEST_URL: 'http://localhost:3200',
  SIM_AUDIT_RECORDER_URL: 'http://localhost:5100',
  SIM_GATEWAY_ADMIN_URL: 'http://localhost:8888',
};

describe('sim-canary-controller env', () => {
  it('compose blank optional overrides are treated as unset', () => {
    const env = parseEnv({
      ...BASE_ENV,
      SIM_CONTROLLER_DWELL_MS: '',
      SIM_CONTROLLER_CANDIDATE_VERSION: '',
    });

    expect(env.SIM_CONTROLLER_DWELL_MS).toBeUndefined();
    expect(env.SIM_CONTROLLER_CANDIDATE_VERSION).toBeUndefined();
  });

  it('optional numeric overrides are coerced when configured', () => {
    const env = parseEnv({
      ...BASE_ENV,
      SIM_CONTROLLER_DWELL_MS: '15000',
      SIM_CONTROLLER_CANDIDATE_VERSION: '4',
    });

    expect(env.SIM_CONTROLLER_DWELL_MS).toBe(15_000);
    expect(env.SIM_CONTROLLER_CANDIDATE_VERSION).toBe(4);
  });
});
