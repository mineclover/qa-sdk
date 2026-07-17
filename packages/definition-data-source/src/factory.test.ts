// @def.doc definition-data-source

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDataSource } from './factory.js';
import { syncDocsToLocalDb } from './sync-local-db.js';

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qa-sdk-def-factory-'));
  tempDirs.push(dir);
  return dir;
}

function writeSampleDoc(rootDir: string) {
  const docsDir = join(rootDir, 'docs');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(
    join(docsDir, 'sample.spec.md'),
    `---
def:
  id: sample-doc
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
---
# Sample

## 목적 ^purpose

factory test sample
`,
    'utf8',
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('createDataSource', () => {
  it('scan 모드에서 nested cwd여도 workspace root의 docs를 찾는다', async () => {
    const rootDir = makeTempDir();
    mkdirSync(join(rootDir, 'packages/cli'), { recursive: true });
    writeFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n', 'utf8');
    writeSampleDoc(rootDir);

    vi.spyOn(process, 'cwd').mockReturnValue(join(rootDir, 'packages/cli'));

    const source = await createDataSource({ mode: 'scan' });
    expect(source.mode).toBe('scan');
    await expect(source.get('sample-doc')).resolves.toMatchObject({
      docId: 'sample-doc',
    });
    await expect(source.getBody('sample-doc')).resolves.toMatchObject({
      bodyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('local 모드에서 nested cwd여도 workspace root의 DB를 찾는다', async () => {
    const rootDir = makeTempDir();
    mkdirSync(join(rootDir, 'packages/cli'), { recursive: true });
    mkdirSync(join(rootDir, 'data'), { recursive: true });
    writeFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n', 'utf8');
    writeSampleDoc(rootDir);
    await syncDocsToLocalDb({ rootDir });

    vi.spyOn(process, 'cwd').mockReturnValue(join(rootDir, 'packages/cli'));

    const source = await createDataSource({ mode: 'local' });
    expect(source.mode).toBe('local');
    await expect(source.get('sample-doc')).resolves.toMatchObject({
      docId: 'sample-doc',
    });
  });
});
