import type { ExpectedTaxonomy } from "./index.js";

/**
 * extractTextsFromMarkdownTable — markdown 표의 한 칼럼에서 cell의 plain text 추출.
 * backtick 제거, **굵게** 표시된 행은 skipBold 옵션으로 제외.
 * tableIndex (0-based): 문서 내 n번째 표에서만 추출. 기본값 0 (첫 표).
 */
export function extractTextsFromMarkdownTable(
  markdown: string,
  columnIndex: number,
  opts: { skipBold?: boolean; tableIndex?: number } = {},
): string[] {
  const out: string[] = [];
  const lines = markdown.split("\n");
  let inTable = false;
  let headerSeen = false;
  const skipBold = opts.skipBold ?? true;
  const tableIndex = opts.tableIndex ?? 0;
  let tableCount = -1; // 첫 표 진입 시 0이 됨

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable && trimmed === "") {
        // 표 종료
        inTable = false;
        headerSeen = false;
        // 이미 목표 표를 처리했으면 종료
        if (tableCount === tableIndex) break;
      }
      continue;
    }
    if (!inTable) {
      inTable = true;
      headerSeen = false;
      tableCount++;
      continue;
    }
    // 목표 표가 아니면 skip
    if (tableCount !== tableIndex) continue;
    // separator line (|---|---|) skip
    if (/^\|[\s:-]+\|/.test(trimmed)) {
      headerSeen = true;
      continue;
    }
    if (!headerSeen) continue;

    // 데이터 row — 칼럼 추출
    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
    if (columnIndex >= cells.length) continue;
    const cell = cells[columnIndex];
    // skipBold: **텍스트** 형태의 셀 제외
    if (skipBold && /^\*\*.*\*\*$/.test(cell)) continue;
    // backtick 제거 (있을 경우)
    const cleaned = cell.replace(/`/g, "").trim();
    if (cleaned === "") continue;
    out.push(cleaned);
  }

  return out;
}

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

/**
 * extractIdsFromMarkdownTable — markdown 표의 한 칼럼에서 backtick으로 둘러싸인 id 목록을 추출.
 *
 * 입력 예시 (한 줄):
 *   "| 카탈로그 승계 (4종) | `axis`, `prefix`, `spec`, `schema` | ... |"
 *
 * `columnIndex` (0-based)로 어느 칼럼에서 추출할지 지정.
 * 반환: id 문자열 배열 (등장 순서 보존).
 */
export function extractIdsFromMarkdownTable(
  markdown: string,
  columnIndex: number,
): string[] {
  const ids: string[] = [];
  const lines = markdown.split("\n");
  let inTable = false;
  let headerSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable && trimmed === "") {
        // 표 종료
        inTable = false;
        headerSeen = false;
      }
      continue;
    }
    if (!inTable) {
      inTable = true;
      headerSeen = false;
      continue;
    }
    // separator line (|---|---|) skip
    if (/^\|[\s:-]+\|/.test(trimmed)) {
      headerSeen = true;
      continue;
    }
    if (!headerSeen) continue;

    // 데이터 row — 칼럼 추출
    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
    if (columnIndex >= cells.length) continue;
    const targetCell = cells[columnIndex];
    // backtick 둘러싸인 id 추출
    const matches = targetCell.match(/`([^`]+)`/g);
    if (!matches) continue;
    for (const m of matches) {
      ids.push(m.slice(1, -1));
    }
  }

  return ids;
}

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

/**
 * extractDkgExpected — DKG spec markdown 두 파일에서 expected taxonomy 생성.
 *
 * node-kind: dkg-node-types.spec.md 두 번째 칼럼 (index 1) — "노드"
 * edge-kind: dkg-edge-types.spec.md 두 번째 칼럼 (index 1) — "엣지 타입"
 *
 * node-tier / edge-group 는 yaml slug 기반이라 spec 표에서 직접 파생 어려움 → skip.
 */
export function extractDkgExpected(
  nodeTypesMd: string,
  edgeTypesMd: string,
): ExpectedTaxonomy {
  const nodeIds = extractIdsFromMarkdownTable(nodeTypesMd, 1);
  const edgeIds = extractIdsFromMarkdownTable(edgeTypesMd, 1);

  return {
    taxonomy: "dkg-schema",
    axes: {
      "node-kind": {
        entries: nodeIds.map((id) => ({ id })),
      },
      "edge-kind": {
        entries: edgeIds.map((id) => ({ id })),
      },
    },
  };
}
