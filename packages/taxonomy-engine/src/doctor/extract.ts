import type { ExpectedTaxonomy } from "./index.js";

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
