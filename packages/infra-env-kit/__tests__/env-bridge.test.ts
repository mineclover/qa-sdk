import { describe, expect, it } from 'vitest';

import { configToEnvVars, extractServiceEnv } from '../src/env-bridge.js';
import type { EnvResolvedConfig } from '../src/types.js';

describe('infra-env-kit env-bridge', () => {
  it('configToEnvVars는 infra 내부 키를 제외한다', () => {
    const env = configToEnvVars({
      port: 3200,
      store_driver: 'd1',
      depends_on: ['registry-service'],
      gates: [{ name: 'health' }],
      health_path: '/health/live',
    });

    expect(env).toEqual({
      PORT: '3200',
      STORE_DRIVER: 'd1',
    });
  });

  it('extractServiceEnv는 configToEnvVars 규칙을 재사용한다', () => {
    const config: EnvResolvedConfig = {
      services: {
        'ingest-server': {
          port: 3200,
          store_driver: 'd1',
          depends_on: ['registry-service'],
          health_path: '/health/live',
        },
      },
      connections: {},
    };

    expect(extractServiceEnv(config, 'ingest-server')).toEqual({
      PORT: '3200',
      STORE_DRIVER: 'd1',
    });
  });
});
