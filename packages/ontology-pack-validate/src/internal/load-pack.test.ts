import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { OperationalOntologyPack } from 'operational-ontology/pack';
import { describe, expect, it } from 'vitest';

import { loadOntologyPack } from './load-pack.js';

describe('ontology pack validate loader', () => {
  it('resolves known pack ids without file IO', async () => {
    const loaded = await loadOntologyPack(
      'programming-artifact-ontology',
      process.cwd(),
      process.cwd(),
    );

    expect(loaded.issues).toEqual([]);
    expect(loaded.resolution).toMatchObject({
      kind: 'known-pack',
      packRef: 'programming-artifact-ontology',
      knownPackId: 'programming-artifact-ontology',
    });
    expect(loaded.pack?.packId).toBe('programming-artifact-ontology');
  });

  it('loads JSON pack objects by file path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-sdk-pack-loader-json-'));
    try {
      await writeFile(
        join(dir, 'sample-pack.json'),
        JSON.stringify(minimalPack('sample-json-ontology'), null, 2),
      );

      const loaded = await loadOntologyPack('sample-pack.json', dir, dir);

      expect(loaded.issues).toEqual([]);
      expect(loaded.pack?.packId).toBe('sample-json-ontology');
      expect(loaded.resolution).toMatchObject({
        kind: 'file-path',
        filePath: 'sample-pack.json',
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('loads default exports from built ESM modules', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-sdk-pack-loader-mjs-'));
    try {
      await writeFile(
        join(dir, 'sample-pack.mjs'),
        `export default ${JSON.stringify(minimalPack('sample-mjs-ontology'), null, 2)};\n`,
      );

      const loaded = await loadOntologyPack('sample-pack.mjs', dir, dir);

      expect(loaded.issues).toEqual([]);
      expect(loaded.pack?.packId).toBe('sample-mjs-ontology');
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('loads named pack exports from built JS and CJS modules', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-sdk-pack-loader-js-cjs-'));
    try {
      await writeFile(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
      await writeFile(
        join(dir, 'sample-pack.js'),
        `export const ontologyPack = ${JSON.stringify(minimalPack('sample-js-ontology'), null, 2)};\n`,
      );
      await writeFile(
        join(dir, 'sample-pack.cjs'),
        `exports.pack = ${JSON.stringify(minimalPack('sample-cjs-ontology'), null, 2)};\n`,
      );

      const jsLoaded = await loadOntologyPack('sample-pack.js', dir, dir);
      const cjsLoaded = await loadOntologyPack('sample-pack.cjs', dir, dir);

      expect(jsLoaded.issues).toEqual([]);
      expect(jsLoaded.pack?.packId).toBe('sample-js-ontology');
      expect(cjsLoaded.issues).toEqual([]);
      expect(cjsLoaded.pack?.packId).toBe('sample-cjs-ontology');
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('reports ambiguous module pack exports as loader diagnostics', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-sdk-pack-loader-ambiguous-'));
    try {
      await writeFile(
        join(dir, 'ambiguous-pack.mjs'),
        [
          `export const firstPack = ${JSON.stringify(minimalPack('first-ontology'), null, 2)};`,
          `export const secondPack = ${JSON.stringify(minimalPack('second-ontology'), null, 2)};`,
          '',
        ].join('\n'),
      );

      const loaded = await loadOntologyPack('ambiguous-pack.mjs', dir, dir);

      expect(loaded.pack).toBeNull();
      expect(loaded.issues).toEqual([
        expect.objectContaining({
          level: 'error',
          source: 'loader',
          path: 'module.exports',
          code: 'pack-export-ambiguous',
        }),
      ]);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});

function minimalPack(packId: string): OperationalOntologyPack {
  return {
    packId,
    schema: {
      axes: [],
      taxonomies: [],
      relationCategories: [],
      traversals: [],
    },
    blueprints: [],
  };
}
