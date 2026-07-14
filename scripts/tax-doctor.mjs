#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, doctor } from '../packages/taxonomy-engine/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAX_DIR = join(__dirname, '..', 'docs', 'taxonomies');
const EXPECTED_DIR = join(__dirname, '..', 'packages', 'taxonomy-engine', '__tests__', 'fixtures');

function main() {
  const files = readdirSync(TAX_DIR).filter((f) => f.endsWith('.yaml'));
  let totalErrors = 0;
  let totalWarnings = 0;
  let checked = 0;

  for (const file of files) {
    const base = basename(file, '.yaml');
    const expectedPath = join(EXPECTED_DIR, `expected-${base}.json`);
    if (!existsSync(expectedPath)) {
      console.log(`-- ${file}: expected 없음 (skip)`);
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    const yamlText = readFileSync(join(TAX_DIR, file), 'utf8');
    const r = parse(yamlText);
    if ('error' in r) {
      console.error(`✖ parse 실패: ${file}`);
      process.exit(1);
    }
    const diags = doctor(r.ir, expected);
    const errs = diags.filter((d) => d.severity === 'error');
    const warns = diags.filter((d) => d.severity === 'warning');
    totalErrors += errs.length;
    totalWarnings += warns.length;
    checked++;
    const tag = errs.length > 0 ? '✖' : warns.length > 0 ? '⚠' : '✔';
    console.log(`${tag} ${file}: ${errs.length} drift errors, ${warns.length} warnings`);
    for (const d of errs) console.log(`    ERR ${d.code}: ${d.message}`);
    for (const d of warns) console.log(`    WARN ${d.code}: ${d.message}`);
  }

  console.log(
    `\ndoctor 검사: ${checked} taxonomies, ${totalErrors} errors, ${totalWarnings} warnings`,
  );
  if (totalErrors > 0) process.exit(1);
}

main();
