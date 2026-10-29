import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERATOR_NAME, GENERATOR_VERSION } from './generator-info.js';

describe('generator-info', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    name: string;
    version: string;
  };

  it('GENERATOR_NAME이 package name과 같다', () => {
    expect(GENERATOR_NAME).toBe(pkg.name);
  });

  it('GENERATOR_VERSION이 package version과 같다', () => {
    expect(GENERATOR_VERSION).toBe(pkg.version);
  });
});
