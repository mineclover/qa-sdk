import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { promoteOpenApiFragment } from './openapi-promote.js';

describe('promoteOpenApiFragment', () => {
  it('promotes a local domain OpenAPI fragment into the central contracts layout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-scaffold-openapi-'));
    const source = join(root, 'src/payment/contracts/openapi/domains/payment/spec.json');
    await writeFixture(source, JSON.stringify({ paths: { '/payment': {} } }));

    const result = await promoteOpenApiFragment({
      source,
      contractsRoot: join(root, 'packages/contracts'),
    });

    expect(result.domain).toBe('payment');
    expect(result.target).toBe(join(root, 'packages/contracts/openapi/domains/payment/spec.json'));
    await expect(readFile(result.target, 'utf8')).resolves.toContain('/payment');
  });

  it('rejects overwriting an existing central domain spec unless force is set', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-scaffold-openapi-'));
    const source = join(root, 'src/payment/contracts/openapi/domains/payment/spec.json');
    const target = join(root, 'packages/contracts/openapi/domains/payment/spec.json');
    await writeFixture(source, JSON.stringify({ paths: { '/payment': {} } }));
    await writeFixture(target, JSON.stringify({ paths: { '/existing': {} } }));

    await expect(
      promoteOpenApiFragment({
        source,
        contractsRoot: join(root, 'packages/contracts'),
      }),
    ).rejects.toThrow('already exists');

    await expect(
      promoteOpenApiFragment({
        source,
        contractsRoot: join(root, 'packages/contracts'),
        force: true,
      }),
    ).resolves.toMatchObject({ domain: 'payment' });
  });
});

async function writeFixture(path: string, content: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${content}\n`);
}
