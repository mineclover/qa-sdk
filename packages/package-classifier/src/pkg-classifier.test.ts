// @def.boundary package-classifier-spec
// @def.doc package-classifier-test

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanAndClassify } from './pkg-classifier.js';

describe('scanAndClassify', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses package.json private field for scope classification', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-classifier-'));
    roots.push(root);
    mkdirSync(join(root, 'packages', 'public-scoped'), { recursive: true });
    mkdirSync(join(root, 'packages', 'private-scoped'), { recursive: true });

    writeFileSync(
      join(root, 'packages', 'public-scoped', 'package.json'),
      JSON.stringify({ name: '@qa-sdk/public-lib', version: '0.1.0', private: false }, null, 2),
    );
    writeFileSync(
      join(root, 'packages', 'private-scoped', 'package.json'),
      JSON.stringify({ name: '@qa-sdk/private-lib', version: '0.1.0', private: true }, null, 2),
    );

    const rows = await scanAndClassify(root);
    expect(rows.find((row) => row.displayName === 'public-lib')?.scope).toBe('public');
    expect(rows.find((row) => row.displayName === 'private-lib')?.scope).toBe('private');
  });
});
