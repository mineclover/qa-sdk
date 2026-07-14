#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, codegen } from '../packages/taxonomy-engine/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAX_DIR = join(__dirname, '..', 'docs', 'taxonomies');
const HASH_FILE = join(TAX_DIR, '.codegen-hashes.json');

const UPDATE = process.argv.includes('--update');

function main() {
  const files = readdirSync(TAX_DIR).filter((f) => f.endsWith('.yaml'));
  const prevHashes = existsSync(HASH_FILE) ? JSON.parse(readFileSync(HASH_FILE, 'utf8')) : {};
  const currentHashes = {};
  let drifted = 0;

  for (const file of files) {
    const text = readFileSync(join(TAX_DIR, file), 'utf8');
    const r = parse(text);
    if ('error' in r) {
      console.error(`✖ parse 실패: ${file}`);
      process.exit(1);
    }
    // codegen은 errors=0 강제. 일부 yaml은 cross-tax 필요 → skipValidate
    const { contentHash } = codegen(r.ir, { skipValidate: true });
    currentHashes[file] = contentHash;
    const prev = prevHashes[file];
    if (prev && prev !== contentHash) {
      console.log(`⚠ ${file}: hash 변경 ${prev} → ${contentHash}`);
      drifted++;
    } else if (!prev) {
      console.log(`+ ${file}: 새 hash ${contentHash}`);
    } else {
      console.log(`✔ ${file}: ${contentHash}`);
    }
  }

  if (UPDATE) {
    writeFileSync(HASH_FILE, JSON.stringify(currentHashes, null, 2) + '\n');
    console.log(`\nhash lockfile 갱신: ${HASH_FILE}`);
    return;
  }

  // strict mode — drift 있으면 fail
  if (drifted > 0) {
    console.error(
      `\n✖ ${drifted} taxonomies의 codegen hash drift. 의도된 변경이면 --update로 lockfile 갱신.`,
    );
    process.exit(1);
  }

  // 첫 실행 (lockfile 없거나 빈 상태) → lockfile 생성하고 통과
  if (!existsSync(HASH_FILE) || Object.keys(prevHashes).length === 0) {
    writeFileSync(HASH_FILE, JSON.stringify(currentHashes, null, 2) + '\n');
    console.log(`\n+ hash lockfile 생성: ${HASH_FILE}`);
  }
}

main();
