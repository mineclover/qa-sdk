// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncDocsToLocalDb } from 'definition-data-source';
import type { DefDataSource } from 'definition-catalog';
import {
  resolveRelatedDocsForFileWithResolution,
  resolveRelatedDocsForFiles,
} from './review-feedback-docs.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '../../../..');

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qa-sdk-review-feedback-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('review-feedback-docs', () => {
  it('none/ambiguous 해석을 후보 문서와 구분해 보존한다', async () => {
    const ambiguousSource = {
      mode: 'local',
      resolveByFile: async () =>
        ({
          kind: 'ambiguous',
          codePath: 'packages/demo/src/shared.ts',
          candidates: [{ anchor: { docId: 'doc-a' } }, { anchor: { docId: 'doc-b' } }],
          references: [],
        }) as never,
    } as unknown as DefDataSource;
    const noneSource = {
      mode: 'local',
      resolveByFile: async () =>
        ({
          kind: 'none',
          codePath: 'packages/demo/src/unknown.ts',
          references: [],
        }) as never,
    } as unknown as DefDataSource;

    await expect(
      resolveRelatedDocsForFileWithResolution(
        '/repo',
        'packages/demo/src/shared.ts',
        ambiguousSource,
      ),
    ).resolves.toEqual({
      relatedDocs: [],
      resolution: {
        kind: 'ambiguous',
        codePath: 'packages/demo/src/shared.ts',
        candidateDocIds: ['doc-a', 'doc-b'],
      },
    });
    await expect(
      resolveRelatedDocsForFileWithResolution('/repo', 'packages/demo/src/unknown.ts', noneSource),
    ).resolves.toEqual({
      relatedDocs: [],
      resolution: {
        kind: 'none',
        codePath: 'packages/demo/src/unknown.ts',
      },
    });
  });

  it('코드 파일에 대해 관련 definition 문서 후보를 찾는다', async () => {
    const rootDir = MONOREPO_ROOT;
    const tempDir = makeTempDir();
    const dbPath = join(tempDir, 'definition-service.sqlite');

    await syncDocsToLocalDb({ rootDir, dbPath });

    const result = await resolveRelatedDocsForFiles(
      rootDir,
      ['packages/review-ledger/src/types.ts', 'packages/review-ledger/src/ledger.ts'],
      {
        mode: 'local',
        dbPath,
      },
    );

    expect(result['packages/review-ledger/src/types.ts']).toBeDefined();
    expect(result['packages/review-ledger/src/types.ts']!.length).toBeGreaterThan(0);
    expect(
      result['packages/review-ledger/src/types.ts']!.some(
        (doc) => doc.docId === 'review-ledger-spec' && doc.reason === 'file-evidence',
      ),
    ).toBe(true);
  }, 20_000);
});
