#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// taxonomy-engine은 packages/taxonomy-web/node_modules에 symlink로 설치됨
const taxonomyEngineDist = join(
  __dirname,
  '..',
  'packages',
  'taxonomy-web',
  'node_modules',
  'taxonomy-engine',
  'dist',
  'index.js',
);
const { parse } = await import(pathToFileURL(taxonomyEngineDist).href);

const TAX_DIR = join(__dirname, '..', 'docs', 'taxonomies');
const OUT_DIR = join(__dirname, '..', 'packages', 'taxonomy-web', 'public', 'data');

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(TAX_DIR).filter((f) => f.endsWith('.yaml'));
const index = [];

for (const file of files) {
  const text = readFileSync(join(TAX_DIR, file), 'utf8');
  const r = parse(text);
  if ('error' in r) {
    console.error(`✖ parse 실패: ${file} — ${r.error.message}`);
    process.exit(1);
  }
  const ir = r.ir;
  // Map → object 직렬화
  const serialized = {
    taxonomy: ir.taxonomy,
    version: ir.version,
    description: ir.description,
    contentHash: ir.contentHash,
    axes: Object.fromEntries(ir.axes),
    relations: Object.fromEntries(ir.relations),
    constraints: ir.constraints,
    imports: ir.imports,
  };
  const outName = basename(file, '.yaml') + '.json';
  writeFileSync(join(OUT_DIR, outName), JSON.stringify(serialized, null, 2));
  index.push({
    name: ir.taxonomy,
    file: outName,
    version: ir.version,
    contentHash: ir.contentHash,
    axesCount: ir.axes.size,
    relationsCount: ir.relations.size,
    constraintsCount: ir.constraints.length,
  });
}

writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify({ taxonomies: index }, null, 2));
console.log(`✔ ${files.length} taxonomies → ${OUT_DIR}`);
