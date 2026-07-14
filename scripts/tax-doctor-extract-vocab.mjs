#!/usr/bin/env node
/**
 * vocabulary.ts DEF_* const에서 expected fixture를 자동 생성한다.
 * 기존 fixture에 address가 있으면 보존한다.
 *
 * 실행: node scripts/tax-doctor-extract-vocab.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractVocabExpected } from '../packages/taxonomy-engine/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOCAB = join(__dirname, '..', 'packages', 'definition-catalog', 'src', 'vocabulary.ts');
const OUT = join(
  __dirname,
  '..',
  'packages',
  'taxonomy-engine',
  '__tests__',
  'fixtures',
  'expected-qa-sdk-def-catalog.json',
);

const text = readFileSync(VOCAB, 'utf8');
const extracted = extractVocabExpected(text);

// 기존 fixture에서 address 보존
let merged = extracted;
if (existsSync(OUT)) {
  const existing = JSON.parse(readFileSync(OUT, 'utf8'));
  const addrMap = new Map();
  for (const [axisName, axisData] of Object.entries(existing.axes ?? {})) {
    for (const e of axisData.entries ?? []) {
      if (e.address !== undefined) addrMap.set(`${axisName}.${e.id}`, e.address);
    }
  }
  for (const [axisName, axisData] of Object.entries(extracted.axes)) {
    axisData.entries = axisData.entries.map((e) => {
      const addr = addrMap.get(`${axisName}.${e.id}`);
      return addr !== undefined ? { ...e, address: addr } : e;
    });
  }
  merged = extracted;
}

// entry 객체는 한 줄로 직렬화 (fixture 형식 통일)
const json = JSON.stringify(merged, null, 2).replace(
  /\{\n\s+"id": "([^"]+)"(,\n\s+"address": (\d+))?\n\s+\}/g,
  (_, id, _addrLine, addr) =>
    addr !== undefined ? `{ "id": "${id}", "address": ${addr} }` : `{ "id": "${id}" }`,
);
writeFileSync(OUT, json + '\n');

const totalEntries = Object.values(merged.axes).reduce((sum, axis) => sum + axis.entries.length, 0);
console.log(
  `✔ ${OUT} 갱신 (axes: ${Object.keys(merged.axes).length}, entries 합계: ${totalEntries})`,
);
