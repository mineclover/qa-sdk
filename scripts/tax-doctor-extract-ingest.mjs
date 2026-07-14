#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractIngestExpected } from '../packages/taxonomy-engine/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INGEST_SPEC = join(
  __dirname,
  '..',
  'docs',
  'specs',
  'ingest',
  'ingest-infra-system',
  'store-adapter-parity.spec.md',
);
const OUT = join(
  __dirname,
  '..',
  'packages',
  'taxonomy-engine',
  '__tests__',
  'fixtures',
  'expected-ingest-coords.json',
);

/**
 * 기존 entries에서 address를 id-keyed Map으로 구성해
 * 추출된 entries에 address를 보존한다.
 */
function preserveAddresses(extractedEntries, existingEntries) {
  const addrMap = new Map();
  for (const e of existingEntries || []) {
    if (e.address !== undefined) addrMap.set(e.id, e.address);
  }
  return extractedEntries.map((e) => {
    const address = addrMap.get(e.id);
    return address !== undefined ? { ...e, address } : e;
  });
}

const md = readFileSync(INGEST_SPEC, 'utf8');
const extracted = extractIngestExpected(md);

// 기존 fixture에서 store-driver/insights-driver/store-coverage 등 + address 보존
const existing = JSON.parse(readFileSync(OUT, 'utf8'));
const mergedStoreKindEntries = preserveAddresses(
  extracted.axes['store-kind'].entries,
  existing.axes['store-kind']?.entries ?? [],
);

const merged = {
  ...existing,
  axes: {
    ...existing.axes,
    'store-kind': { entries: mergedStoreKindEntries },
  },
};

// entry 객체는 한 줄로 직렬화 (기존 fixture 형식 보존)
const json = JSON.stringify(merged, null, 2).replace(
  /\{\n\s+"id": "([^"]+)"(,\n\s+"address": (\d+))?\n\s+\}/g,
  (_, id, _addrLine, addr) =>
    addr !== undefined ? `{ "id": "${id}", "address": ${addr} }` : `{ "id": "${id}" }`,
);
writeFileSync(OUT, json + '\n');
console.log(`✔ ${OUT} 갱신됨 (store-kind: ${mergedStoreKindEntries.length})`);
