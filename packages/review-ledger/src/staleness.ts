// @def.boundary system-root
/**
 * Git 기반 파일 변경 감지.
 *
 * reviewedCommit 이후 해당 파일에 변경이 있었는지 판정.
 * execa 기반.
 */

import { execaSync } from "execa";

/**
 * 파일의 최신 커밋 SHA를 조회한다.
 * 파일이 git에 추적되지 않으면 null.
 */
export function getLatestCommitForFile(
  cwd: string,
  filePath: string,
): string | null {
  try {
    const { stdout } = execaSync("git", ["log", "--format=%H", "-1", "--", filePath], { cwd });
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

/**
 * 여러 파일의 최신 커밋 SHA를 배치 조회한다.
 * 반환: Map<filePath, commitSHA>
 */
export function getLatestCommitsForFiles(
  cwd: string,
  filePaths: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  for (const fp of filePaths) {
    const commit = getLatestCommitForFile(cwd, fp);
    if (commit) result.set(fp, commit);
  }
  return result;
}

/**
 * reviewedCommit 이후 해당 파일이 변경되었는지 판정한다.
 * 반환: { stale: boolean, latestCommit }
 */
export function checkStaleness(
  cwd: string,
  filePath: string,
  reviewedCommit: string,
): { stale: boolean; latestCommit: string | null } {
  const latestCommit = getLatestCommitForFile(cwd, filePath);
  if (!latestCommit) return { stale: false, latestCommit: null };
  // 같은 커밋이면 변경 없음
  if (latestCommit === reviewedCommit) return { stale: false, latestCommit };
  // reviewedCommit 이후 변경 커밋이 있는지 확인
  try {
    const { stdout } = execaSync(
      "git",
      ["rev-list", "--count", `${reviewedCommit}..HEAD`, "--", filePath],
      { cwd },
    );
    return { stale: Number(stdout.trim()) > 0, latestCommit };
  } catch {
    // reviewedCommit이 존재하지 않는 경우 등 → stale 취급
    return { stale: true, latestCommit };
  }
}

/**
 * 현재 HEAD 커밋 SHA를 반환한다.
 */
export function getHeadCommit(cwd: string): string {
  const { stdout } = execaSync("git", ["rev-parse", "HEAD"], { cwd });
  return stdout.trim();
}

/**
 * git ls-files로 추적 중인 전체 파일 목록을 반환한다.
 */
export function listTrackedFiles(cwd: string): string[] {
  const { stdout } = execaSync("git", ["ls-files"], { cwd });
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
