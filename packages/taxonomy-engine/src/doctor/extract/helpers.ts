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
