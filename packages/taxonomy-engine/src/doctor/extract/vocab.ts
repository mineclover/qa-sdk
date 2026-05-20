import type { ExpectedTaxonomy } from "../index.js";

/**
 * extractVocabExpected — vocabulary.ts에서 DEF_* const의 entries 자동 추출.
 * 정규식 기반 — `export const DEF_SCOPE = { entries: [...] as const, ... }` 패턴.
 *
 * 추출 대상: DEF_SCOPE, DEF_DEPTH, DEF_LEVEL, DEF_LIFECYCLE, LINK_TYPE, TAXONOMY_FAMILY
 * DEF_ASPECT(46 entries)는 별도 관리로 제외.
 */
export function extractVocabExpected(vocabTsText: string): ExpectedTaxonomy {
  const axes: ExpectedTaxonomy["axes"] = {};

  // 추출 대상 const 목록: const name → yaml axis name
  const targets: Array<{ const: string; axis: string }> = [
    { const: "DEF_SCOPE", axis: "def_scope" },
    { const: "DEF_DEPTH", axis: "def_depth" },
    { const: "DEF_LEVEL", axis: "def_level" },
    { const: "DEF_LIFECYCLE", axis: "def_lifecycle" },
    { const: "LINK_TYPE", axis: "link_type" },
    { const: "TAXONOMY_FAMILY", axis: "taxonomy_family" },
  ];

  for (const { const: constName, axis } of targets) {
    const regex = new RegExp(
      `export\\s+const\\s+${constName}\\s*=\\s*\\{[^}]*?entries\\s*:\\s*\\[([^\\]]+)\\]`,
      "s",
    );
    const m = vocabTsText.match(regex);
    if (!m) continue;
    const entriesRaw = m[1];
    // entriesRaw 예: '"ui", "feature", "flow", ...'
    const ids = [...entriesRaw.matchAll(/["']([^"']+)["']/g)].map((mm) => mm[1]);
    axes[axis] = { entries: ids.map((id) => ({ id })) };
  }

  return {
    taxonomy: "qa-sdk-def-catalog",
    axes,
  };
}
