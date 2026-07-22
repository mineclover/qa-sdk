import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const forbiddenPatterns: readonly RegExp[] = [
  /process\.env\b/,
  /\bfetch\s*\(/,
  /from\s+['"](?:node:)?(?:fs|net|tls|http|https|child_process|worker_threads)/,
  /from\s+['"](?:openai|@openai\/|drizzle-orm|better-sqlite3|pg|mysql2|undici)/,
];

describe('context-runtime library boundary', () => {
  it('keeps production source pure and read-mostly', () => {
    const sourceFiles = readdirSync(sourceDirectory)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .sort();

    const violations = sourceFiles.flatMap((file) => {
      const source = readFileSync(join(sourceDirectory, file), 'utf8');
      return forbiddenPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${file}: ${pattern}`);
    });

    expect(violations).toEqual([]);
  });
});
