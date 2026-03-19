/**
 * Git 메타데이터 추출 — child_process 기반, 외부 의존 없음.
 */

import { execSync } from "node:child_process";

// ── Types ────────────────────────────────────────────

export interface ConventionalCommit {
  hash: string;
  type: string;
  scope: string | null;
  subject: string;
}

// ── Repo 식별 ────────────────────────────────────────

/** remote origin URL 또는 디렉토리 이름으로 레포명 추출 */
export function getRepoName(cwd: string): string {
  try {
    const url = execSync("git remote get-url origin", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const match = url.match(/\/([^/]+?)(\.git)?$/);
    if (match) return match[1];
  } catch {
    // remote 없으면 fallback
  }
  return cwd.split("/").pop() ?? "unknown";
}

// ── Semver 태그 ──────────────────────────────────────

/** semver 형식 git tag 목록 (v prefix 제거) */
export function listSemverTags(cwd: string): string[] {
  try {
    const raw = execSync("git tag -l", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((t) => t.replace(/^v/, ""))
      .filter((t) => /^\d+\.\d+\.\d+/.test(t))
      .sort();
  } catch {
    return [];
  }
}

// ── Conventional Commits ─────────────────────────────

const CC_PATTERN = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)/;

/** git log에서 conventional commit 파싱 */
export function parseConventionalCommits(
  cwd: string,
  opts?: { since?: string; maxCount?: number },
): ConventionalCommit[] {
  // format에 공백 포함 → 셸 word splitting 방지를 위해 따옴표로 감싸야 함
  let cmd = 'git log --format="%H %s"';
  if (opts?.since) cmd += ` ${opts.since}..HEAD`;
  if (opts?.maxCount) cmd += ` -n ${opts.maxCount}`;

  try {
    const raw = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const commits: ConventionalCommit[] = [];
    for (const line of raw.trim().split("\n")) {
      if (!line) continue;
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx < 0) continue;

      const hash = line.slice(0, spaceIdx);
      const subject = line.slice(spaceIdx + 1);
      const match = subject.match(CC_PATTERN);

      if (match) {
        commits.push({
          hash,
          type: match[1],
          scope: match[2] ?? null,
          subject: match[3],
        });
      }
    }
    return commits;
  } catch {
    return [];
  }
}

// ── Commit Type 집계 ─────────────────────────────────

/** 기본 conventional commit 타입 (항상 포함) */
const STANDARD_CC_TYPES = ["feat", "fix", "refactor", "docs", "test", "chore"];

/**
 * git log에서 실제 사용된 cc type + 표준 타입 합집합.
 * 반환: 정렬된 타입 목록.
 */
export function collectCommitTypes(cwd: string): string[] {
  const commits = parseConventionalCommits(cwd);
  const seen = new Set(commits.map((c) => c.type));
  for (const std of STANDARD_CC_TYPES) seen.add(std);
  return [...seen].sort();
}

/**
 * scope(패키지)별 commit type 카운트.
 * 반환: Record<scope, Record<type, count>>
 */
export function commitCountsByScope(
  cwd: string,
): Record<string, Record<string, number>> {
  const commits = parseConventionalCommits(cwd);
  const counts: Record<string, Record<string, number>> = {};

  for (const c of commits) {
    if (!c.scope) continue;
    counts[c.scope] ??= {};
    counts[c.scope][c.type] = (counts[c.scope][c.type] ?? 0) + 1;
  }

  return counts;
}
