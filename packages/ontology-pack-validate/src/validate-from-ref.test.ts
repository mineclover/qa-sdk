import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateOntologyPackFromRef } from './index.js';

/**
 * Spec: `docs/specs/definition-catalog/ontology-pack-validate.spec.md`
 *
 * Entry point (`validateOntologyPackFromRef`)의 오류/경계 경로 커버리지.
 * Internal module 테스트는 개별 모듈 테스트에서 담당하고, 본 스위트는
 * public API 수준의 계약 (resolution / issue surface / DI 정책)을 검증.
 */

describe('validateOntologyPackFromRef — error/boundary paths', () => {
  it('returns unresolved resolution with resolver error for unknown pack id', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opv-unknown-'));
    try {
      await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');

      const result = await validateOntologyPackFromRef({
        packRef: 'does-not-exist-pack',
        rootDir: dir,
      });

      expect(result.valid).toBe(false);
      expect(result.packId).toBeNull();
      expect(result.resolution.kind).toBe('unresolved');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'error',
            source: 'resolver',
          }),
        ]),
      );
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('returns loader error for malformed JSON pack file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opv-malformed-'));
    try {
      await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await writeFile(join(dir, 'broken-pack.json'), '{ not: valid json ');

      const result = await validateOntologyPackFromRef({
        packRef: 'broken-pack.json',
        rootDir: dir,
      });

      expect(result.valid).toBe(false);
      expect(result.packId).toBeNull();
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'error',
          }),
        ]),
      );
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('surfaces loader error when file path resolves but file is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opv-missing-'));
    try {
      await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');

      const result = await validateOntologyPackFromRef({
        packRef: 'nonexistent.json',
        rootDir: dir,
      });

      // .json 확장자면 resolution.kind는 file-path로 잡히되 loader가 읽기 실패
      expect(result.resolution.kind).toBe('file-path');
      expect(result.issues.some((issue) => issue.level === 'error')).toBe(true);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('emits docs-reader-not-injected warning when readDocsFamily is omitted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opv-noreader-'));
    try {
      await mkdir(join(dir, 'packages', 'sample', 'src'), { recursive: true });
      await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await writeFile(join(dir, 'packages', 'sample', 'src', 'covered.ts'), 'export {};\n');
      await writeFile(join(dir, 'sample-pack.json'), JSON.stringify(minimalPack(), null, 2));

      const result = await validateOntologyPackFromRef({
        packRef: 'sample-pack.json',
        rootDir: dir,
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'warning',
            source: 'docs',
            code: 'docs-reader-not-injected',
          }),
        ]),
      );
      expect(result.readiness.docs.status).toBe('skipped');
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('does not emit docs-reader-not-injected warning when readDocsFamily is provided', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opv-withreader-'));
    try {
      await mkdir(join(dir, 'packages', 'sample', 'src'), { recursive: true });
      await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await writeFile(join(dir, 'packages', 'sample', 'src', 'covered.ts'), 'export {};\n');
      await writeFile(join(dir, 'sample-pack.json'), JSON.stringify(minimalPack(), null, 2));

      const result = await validateOntologyPackFromRef({
        packRef: 'sample-pack.json',
        rootDir: dir,
        readDocsFamily: async () => [],
      });

      expect(result.issues).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'docs-reader-not-injected',
          }),
        ]),
      );
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});

function minimalPack(): Record<string, unknown> {
  return {
    packId: 'sample-ontology',
    schema: {
      axes: [
        {
          id: 'sample_kind',
          values: ['example'],
          stable: true,
          capacity: 4,
        },
      ],
      taxonomies: [
        {
          id: 'sample',
          appliesTo: ['node'],
          axisIds: ['sample_kind'],
          identityAxisIds: ['sample_kind'],
          space: 'sample-ontology',
        },
      ],
      relationCategories: [],
      traversals: [],
    },
    blueprints: [
      {
        blueprintId: 'sample-binding',
        coordinateRef: 'sample:binding',
        unitKind: 'corridor_bundle',
        requiredSchemas: ['sample'],
        implementationBinding: {
          coordinateRef: 'sample:binding',
          implementationRefs: [{ kind: 'code', ref: 'packages/sample/src/covered.ts' }],
        },
        verificationBinding: {
          coordinateRef: 'sample:binding',
          verificationRefs: [],
        },
      },
    ],
  };
}
