#!/usr/bin/env tsx
/**
 * DEMO_CATALOG → BROWSER_CATALOG 자동 생성.
 *
 * 변환은 core `flattenForBrowser`가 정본이다 (재구현 금지).
 * 출력은 같은 catalog·같은 generator version이면 항상 같은 바이트다 — 시각·환경 값을 쓰지 않는다.
 *
 * Usage:
 *   tsx scripts/generate-browser-catalog.ts [--out <path>]
 *   pnpm --filter @qa-sdk/viz-3d prebuild
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { browserCatalogSnapshotOf, flattenForBrowser, shortDigest } from '@qa-sdk/core';
import type { Catalog } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_PATH = resolve(__dirname, '../../browser-codec/src/demo-catalog-browser.ts');

/** 헤더에 기록하는 generator 식별자 — 버전은 viz-3d package.json에서 파생 */
const GENERATOR_NAME = 'generate-browser-catalog';
const GENERATOR_VERSION = (
  JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as { version: string }
).version;

/** 식별자로 쓸 수 없는 prefix id만 따옴표로 감싼다 */
function objectKey(id: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(id) ? id : JSON.stringify(id);
}

/** Catalog → demo-catalog-browser.ts 소스 문자열 (순수 함수) */
export async function renderBrowserCatalogSource(catalog: Catalog): Promise<string> {
  const flat = flattenForBrowser(catalog);
  const snapshot = await browserCatalogSnapshotOf(catalog);

  const lines: string[] = [];
  lines.push(
    `// Generated from Catalog "${snapshot.catalog_id}" (hash: ${shortDigest(snapshot.digest)}) by ${GENERATOR_NAME}@${GENERATOR_VERSION}`,
  );
  lines.push(`// catalogDigest: ${snapshot.digest}`);
  lines.push(`// !! 자동 생성 파일 — 직접 수정 금지 !!`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * DEMO_CATALOG의 브라우저용 경량 JSON.`);
  lines.push(` *`);
  lines.push(` * demo-snapshot의 DEMO_CATALOG에서 encode/decode에 필요한 최소 정보만 추출.`);
  lines.push(` * viz-3d-core.js 번들에 포함되어 브라우저에서 직접 사용.`);
  lines.push(` *`);
  lines.push(` * 재생성: pnpm codegen:update (검사: pnpm codegen:check)`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import type { BrowserCatalog } from "./browser-codec.js";`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * BROWSER_CATALOG가 파생된 Catalog 문맥.`);
  lines.push(
    ` * @qa-sdk/core BrowserCatalogSnapshot과 같은 형태 (browser-codec은 core에 의존하지 않는다).`,
  );
  lines.push(` */`);
  lines.push(`export const BROWSER_CATALOG_SNAPSHOT = {`);
  lines.push(`  catalog_id: ${JSON.stringify(snapshot.catalog_id)},`);
  lines.push(`  digest: ${JSON.stringify(snapshot.digest)},`);
  lines.push(`  codec_version: ${JSON.stringify(snapshot.codec_version)},`);
  lines.push(`} as const;`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * DEMO_CATALOG 경량 버전.`);
  lines.push(` * demo-snapshot을 빌드 시점에 참조하여 생성한 정적 데이터.`);
  lines.push(` */`);
  lines.push(`export const BROWSER_CATALOG: BrowserCatalog = {`);
  for (const [prefixId, def] of Object.entries(flat)) {
    lines.push(`  ${objectKey(prefixId)}:${JSON.stringify(def)},`);
  }
  lines.push(`};`);
  lines.push(``);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputPath = values.out ? resolve(values.out) : DEFAULT_OUTPUT_PATH;
  const source = await renderBrowserCatalogSource(DEMO_CATALOG);
  writeFileSync(outputPath, source, 'utf-8');
  const count = Object.keys(flattenForBrowser(DEMO_CATALOG)).length;
  console.log(`✓ BROWSER_CATALOG 생성 완료: ${count}개 prefix → ${outputPath}`);
}

// 테스트에서 import할 때는 실행하지 않는다
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
