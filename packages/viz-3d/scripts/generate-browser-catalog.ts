#!/usr/bin/env tsx
/**
 * DEMO_CATALOG → BROWSER_CATALOG 자동 생성.
 *
 * 수동 동기화를 제거한다. prebuild 스크립트로 실행.
 *
 * Usage:
 *   tsx scripts/generate-browser-catalog.ts
 *   pnpm --filter @qa-sdk/viz-3d prebuild
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// demo-snapshot에서 DEMO_CATALOG 로드
import { DEMO_CATALOG } from "demo-snapshot";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../src/adapter/demo-catalog-browser.ts");

// ── 변환 로직 (core/catalog/browser-flatten.ts와 동일) ──────

interface BrowserDimDef {
  readonly kind: "axis" | "prefix_ref";
  readonly entries?: readonly string[];
  readonly capacity?: number;
  readonly values?: readonly number[];
}

interface BrowserPrefixDef {
  readonly version: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, BrowserDimDef>;
}

type BrowserCatalog = Record<string, BrowserPrefixDef>;

function flattenForBrowser(): BrowserCatalog {
  const result: Record<string, BrowserPrefixDef> = {};

  for (const [prefixId, prefix] of Object.entries(DEMO_CATALOG.prefixes)) {
    const latestVersion = prefix.versions[prefix.versions.length - 1];
    if (!latestVersion) continue;

    const dims: Record<string, BrowserDimDef> = {};
    const labels: string[] = [];

    for (const [label, dimRef] of Object.entries(prefix.dims)) {
      if (dimRef.kind === "axis") {
        const axis = DEMO_CATALOG.axes[dimRef.axisId];
        if (!axis) continue;
        const axisVersion = latestVersion.axisVersions[label]
          ?? latestVersion.axisVersions[dimRef.axisId];
        if (!axisVersion) continue;
        const snapshot = axis.versions[axisVersion];
        if (!snapshot) continue;
        dims[label] = {
          kind: "axis",
          entries: snapshot.entries,
          capacity: snapshot.capacity ?? snapshot.entries.length,
        };
        labels.push(label);
      } else if (dimRef.kind === "prefix_ref") {
        const refEntries = latestVersion.refEntries?.[label];
        if (refEntries) {
          dims[label] = { kind: "prefix_ref", values: refEntries.values };
          labels.push(label);
        }
      }
      // table_ref → skip
    }

    if (Object.keys(dims).length === 0) continue;
    result[prefixId] = { version: latestVersion.version, labels, dims };
  }

  return result;
}

// ── 생성 ─────────────────────────────────────────────────────

const catalog = flattenForBrowser();

// 기존 파일과 동일한 형식으로 출력 (minified JSON per line)
const lines: string[] = [];
lines.push(`/**`);
lines.push(` * DEMO_CATALOG의 브라우저용 경량 JSON.`);
lines.push(` *`);
lines.push(` * demo-snapshot의 DEMO_CATALOG에서 encode/decode에 필요한 최소 정보만 추출.`);
lines.push(` * viz-3d-core.js 번들에 포함되어 브라우저에서 직접 사용.`);
lines.push(` *`);
lines.push(` * ⚠️ 이 파일은 자동 생성됨. 직접 수정하지 마세요.`);
lines.push(` *    pnpm --filter @qa-sdk/viz-3d prebuild 으로 재생성.`);
lines.push(` */`);
lines.push(``);
lines.push(`import type { BrowserCatalog } from "./browser-codec.js";`);
lines.push(``);
lines.push(`/**`);
lines.push(` * DEMO_CATALOG 경량 버전.`);
lines.push(` * demo-snapshot을 빌드 시점에 참조하여 생성한 정적 데이터.`);
lines.push(` */`);
lines.push(`export const BROWSER_CATALOG: BrowserCatalog = {`);

for (const [prefixId, def] of Object.entries(catalog)) {
  lines.push(`  ${prefixId}:${JSON.stringify(def)},`);
}

lines.push(`};`);
lines.push(``);

writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf-8");

const count = Object.keys(catalog).length;
console.log(`✓ BROWSER_CATALOG 생성 완료: ${count}개 prefix → ${OUTPUT_PATH}`);
