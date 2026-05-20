import type { ExpectedTaxonomy } from "../index.js";
import { extractTextsFromMarkdownTable } from "./helpers.js";

/**
 * pascalToKebabStripSuffix — "RecordStore" → "record", "ScenarioSpecStore" → "scenario-spec"
 */
function pascalToKebabStripSuffix(text: string, suffix: string): string {
  let s = text;
  if (s.endsWith(suffix)) s = s.slice(0, -suffix.length);
  // PascalCase → kebab-case
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * extractIngestExpected — store-adapter-parity.spec.md에서 9 store-kind 추출.
 * 첫 표 첫 칼럼 (Store 포트) — PascalCase class name → kebab-case id 변환.
 */
export function extractIngestExpected(adapterParityMd: string): ExpectedTaxonomy {
  // 첫 표의 첫 칼럼 (Store 포트) — 9 PascalCase 이름
  const storeNames = extractTextsFromMarkdownTable(adapterParityMd, 0);
  const storeKindIds = storeNames.map((name) =>
    pascalToKebabStripSuffix(name, "Store"),
  );

  return {
    taxonomy: "ingest-coords",
    axes: {
      "store-kind": {
        entries: storeKindIds.map((id) => ({ id })),
      },
    },
  };
}
