import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runPostDeployCodegen } from '../src/codegen.js';
import type { EnvDiscoveryClient } from '../src/types.js';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function makeDiscovery(): EnvDiscoveryClient {
  const services = [
    {
      serviceId: 'ingest-server',
      name: 'Ingest',
      url: 'http://localhost:3200',
      tier: 'backend',
      ownedPrefixes: ['ingest_event'],
      consumedPrefixes: [],
    },
    {
      serviceId: 'gateway',
      name: 'Gateway',
      url: 'http://localhost:8787',
      tier: 'backend',
      ownedPrefixes: [],
      consumedPrefixes: ['ingest_event'],
    },
  ];

  return {
    resolve: async (serviceId, env) => {
      const service = services.find((entry) => entry.serviceId === serviceId);
      return service ? { ...service, urls: { [env ?? 'dev']: service.url } } : null;
    },
    resolveAll: async () => ({
      'ingest-server': 'http://localhost:3200',
      gateway: 'http://localhost:8787',
    }),
    listServices: async () => services,
  };
}

describe('infra-env-kit codegen', () => {
  it('service-connections와 env 파일을 생성한다', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'infra-env-kit-'));
    const tsOutputDir = join(tempDir, 'ts');
    const envOutputDir = join(tempDir, 'env');

    const result = await runPostDeployCodegen(makeDiscovery(), 'ingest-server', 'dev', {
      tsOutputDir,
      envOutputDir,
      configPath: join(process.cwd(), 'packages/infra-engine/config/dev.json'),
    });

    expect(result.tsPath).toContain('service-connections.dev.ts');
    expect(result.envPaths).toHaveLength(2);

    const tsContent = await readFile(result.tsPath!, 'utf-8');
    expect(tsContent).toContain('SERVICE_URLS');

    const selfEnv = await readFile(result.envPaths[0]!, 'utf-8');
    expect(selfEnv).toContain('PORT=3200');
  });
});
