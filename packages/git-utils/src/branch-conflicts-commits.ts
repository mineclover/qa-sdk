import { execaSync } from "execa";
import type { BranchChangeCommit, BranchSplitPoint } from "./branch-conflicts-types.js";

const CONVENTIONAL_COMMIT_PATTERN = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)/;

export function collectBranchCommits(
  cwd: string,
  mergeBaseOid: string,
  headOid: string,
  maxCommitHistory: number,
): { commitCount: number; commits: BranchChangeCommit[] } {
  if (mergeBaseOid === headOid) {
    return { commitCount: 0, commits: [] };
  }

  const range = `${mergeBaseOid}..${headOid}`;
  const { stdout: countStdout } = execaSync("git", ["rev-list", "--count", range], { cwd });
  const commitCount = Number(countStdout.trim() || "0");
  if (commitCount === 0) {
    return { commitCount: 0, commits: [] };
  }

  const { stdout } = execaSync(
    "git",
    [
      "log",
      `--max-count=${maxCommitHistory}`,
      "--date=iso-strict",
      "--format=__COMMIT__%n%H%x09%h%x09%cI%x09%an%x09%ae%x09%s",
      "--name-only",
      range,
    ],
    { cwd },
  );

  const commits: BranchChangeCommit[] = [];
  let current: BranchChangeCommit | null = null;

  for (const line of stdout.split(/\r?\n/)) {
    if (line === "__COMMIT__") {
      if (current) commits.push(finalizeBranchCommit(current));
      current = null;
      continue;
    }

    if (!current) {
      if (!line.trim()) continue;
      const [oid = "", shortOid = "", committedAt = "", authorName = "", authorEmail = "", ...subjectParts] = line.split("\t");
      const summary = subjectParts.join("\t");
      const parsed = parseConventionalCommit(summary);
      current = {
        oid,
        shortOid,
        committedAt,
        authorName,
        authorEmail,
        summary,
        conventionalType: parsed?.type ?? null,
        conventionalScope: parsed?.scope ?? null,
        breaking: parsed?.breaking ?? false,
        changedPaths: [],
      };
      continue;
    }

    if (!line.trim()) continue;
    current.changedPaths.push(line.trim());
  }

  if (current) commits.push(finalizeBranchCommit(current));

  return { commitCount, commits };
}

export function collectCommitSummary(
  cwd: string,
  oid: string,
): BranchSplitPoint {
  try {
    const { stdout } = execaSync(
      "git",
      [
        "show",
        "-s",
        "--date=iso-strict",
        "--format=%H%x09%h%x09%cI%x09%an%x09%ae%x09%s",
        oid,
      ],
      { cwd },
    );
    const [fullOid = "", shortOid = "", committedAt = "", authorName = "", authorEmail = "", ...subjectParts] = stdout.trim().split("\t");
    return {
      oid: fullOid,
      shortOid,
      committedAt,
      authorName,
      authorEmail,
      summary: subjectParts.join("\t"),
      diffStats: collectCommitDiffStats(cwd, oid),
      changedPaths: collectCommitChangedPaths(cwd, oid),
    };
  } catch {
    // merge-base OID가 유효하지 않거나 git show 실패
    return {
      oid,
      shortOid: oid.slice(0, 7),
      committedAt: "",
      authorName: "",
      authorEmail: "",
      summary: "",
      diffStats: { filesChanged: 0, insertions: 0, deletions: 0 },
      changedPaths: [],
    };
  }
}

function collectCommitDiffStats(
  cwd: string,
  oid: string,
): BranchSplitPoint["diffStats"] {
  const { stdout } = execaSync("git", ["show", "--numstat", "--format=", oid], {
    cwd,
  });

  const stats = stdout.split(/\r?\n/).filter(Boolean).reduce((acc, line) => {
    const [additionsRaw = "0", deletionsRaw = "0"] = line.split("\t");
    const additions = additionsRaw === "-" ? 0 : Number(additionsRaw);
    const deletions = deletionsRaw === "-" ? 0 : Number(deletionsRaw);
    return {
      filesChanged: acc.filesChanged + 1,
      insertions: acc.insertions + (Number.isFinite(additions) ? additions : 0),
      deletions: acc.deletions + (Number.isFinite(deletions) ? deletions : 0),
    };
  }, { filesChanged: 0, insertions: 0, deletions: 0 });

  return stats;
}

function collectCommitChangedPaths(
  cwd: string,
  oid: string,
): string[] {
  const { stdout } = execaSync("git", ["show", "--name-only", "--format=", oid], {
    cwd,
  });

  return [...new Set(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].toSorted();
}

function parseConventionalCommit(
  summary: string,
): { type: string; scope: string | null; breaking: boolean } | null {
  const match = summary.match(CONVENTIONAL_COMMIT_PATTERN);
  if (!match) return null;
  return {
    type: match[1] ?? "",
    scope: match[2] ?? null,
    breaking: Boolean(match[3]),
  };
}

function finalizeBranchCommit(commit: BranchChangeCommit): BranchChangeCommit {
  return {
    ...commit,
    changedPaths: [...new Set(commit.changedPaths)].toSorted(),
  };
}
