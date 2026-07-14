// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, it, expect } from 'vitest';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { codegen } from './codegen.js';

const TMP = join(tmpdir(), 'qa-codegen-test-' + Date.now());

describe('codegen command', () => {
  it('Catalog → TypeScript SDK 생성', async () => {
    const output = join(TMP, 'catalog-output');

    // demo-snapshot에서 카탈로그 로드
    const { DEMO_CATALOG } = await import('demo-snapshot');

    await codegen({
      output,
      loadedCatalog: DEMO_CATALOG,
    });

    // 생성된 파일이 존재하고 타입 정의 포함
    const files = await import('node:fs').then((fs) =>
      fs.readdirSync(output).filter((f) => f.endsWith('.ts')),
    );
    expect(files.length).toBeGreaterThan(0);

    await rm(TMP, { recursive: true, force: true });
  });

  it('codegen 산출물을 artifact registry record로 기록한다', async () => {
    const output = join(TMP, 'registry-output');
    const artifactRegistry = join(TMP, 'artifacts', 'programming-artifacts.json');
    const { DEMO_CATALOG } = await import('demo-snapshot');

    await codegen({
      output,
      loadedCatalog: DEMO_CATALOG,
      artifactRegistry,
    });

    const payload = JSON.parse(await readFile(artifactRegistry, 'utf8')) as {
      artifacts: Array<{
        artifactRef: string;
        kind: string;
        producedByRef?: string;
        ownerDefinitionId?: string;
        materializesOutputRefs?: string[];
        relations?: Array<{ kind: string; toRef: string }>;
      }>;
    };

    expect(payload.artifacts.length).toBeGreaterThan(0);
    expect(payload.artifacts[0]).toMatchObject({
      kind: 'generated-source',
      producedByRef: 'qa-sdk codegen',
      ownerDefinitionId: 'codegen-schema-output',
      materializesOutputRefs: ['apm-codegen-system', 'codegen-schema-output'],
    });
    expect(payload.artifacts[0]!.artifactRef).toContain('registry-output/');
    expect(payload.artifacts[0]!.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'produced_by',
          toRef: 'qa-sdk codegen',
        }),
        expect.objectContaining({
          kind: 'owned_by_definition',
          toRef: 'codegen-schema-output',
        }),
      ]),
    );

    await rm(TMP, { recursive: true, force: true });
  });

  it('catalog 경로가 존재하지 않으면 에러', async () => {
    await expect(
      codegen({ output: join(TMP, 'empty'), catalog: '/nonexistent/path/catalog.ts' }),
    ).rejects.toThrow();
  });
});
