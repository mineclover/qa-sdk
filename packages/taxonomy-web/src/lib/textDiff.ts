/**
 * Line-level diff (LCS 기반).
 * round-trip 시각화 외에는 사용 안 함 — 간단한 구현 유지.
 */

export type DiffLine =
  | { kind: "same"; text: string; lineNoA: number; lineNoB: number }
  | { kind: "remove"; text: string; lineNoA: number }
  | { kind: "add"; text: string; lineNoB: number };

/**
 * 두 텍스트의 line-level diff.
 * 동적 계획 LCS — O(M*N) 시공간. round-trip 결과는 보통 < 200 line이라 충분.
 */
export function lineDiff(a: string, b: string): DiffLine[] {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const m = linesA.length;
  const n = linesB.length;

  // dp[i][j] = LCS length of linesA[0..i] vs linesB[0..j]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        linesA[i - 1] === linesB[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // backtrack — 역순 수집 후 뒤집기
  const out: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (linesA[i - 1] === linesB[j - 1]) {
      out.push({
        kind: "same",
        text: linesA[i - 1],
        lineNoA: i,
        lineNoB: j,
      });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.push({ kind: "remove", text: linesA[i - 1], lineNoA: i });
      i--;
    } else {
      out.push({ kind: "add", text: linesB[j - 1], lineNoB: j });
      j--;
    }
  }
  while (i > 0) {
    out.push({ kind: "remove", text: linesA[i - 1], lineNoA: i });
    i--;
  }
  while (j > 0) {
    out.push({ kind: "add", text: linesB[j - 1], lineNoB: j });
    j--;
  }
  return out.reverse();
}

/**
 * diff 요약 통계.
 */
export function diffStats(diff: readonly DiffLine[]): {
  added: number;
  removed: number;
  same: number;
} {
  let added = 0;
  let removed = 0;
  let same = 0;
  for (const d of diff) {
    if (d.kind === "add") added++;
    else if (d.kind === "remove") removed++;
    else same++;
  }
  return { added, removed, same };
}
