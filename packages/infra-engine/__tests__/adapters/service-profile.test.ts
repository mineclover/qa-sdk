import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServiceProfileAdapter } from '../../src/adapters/service-profile.js';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ServiceProfileAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'svc-profile-'));
    await writeFile(
      join(dir, 'service-profile.json'),
      JSON.stringify({
        mode: 'local',
        insightsDriver: 'local',
        services: { 'test-svc': 'http://old:3200' },
      }),
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('get 기존 URL', async () => {
    const adapter = createServiceProfileAdapter(dir);
    expect(await adapter.get('test-svc')).toBe('http://old:3200');
  });

  it('set → URL 업데이트', async () => {
    const adapter = createServiceProfileAdapter(dir);
    await adapter.set('test-svc', 'http://new:3200');
    expect(await adapter.get('test-svc')).toBe('http://new:3200');
  });

  it('restore → 이전 URL 복원', async () => {
    const adapter = createServiceProfileAdapter(dir);
    await adapter.set('test-svc', 'http://new:3200');
    await adapter.restore('test-svc');
    expect(await adapter.get('test-svc')).toBe('http://old:3200');
  });
});
