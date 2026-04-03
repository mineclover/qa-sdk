import { readFileSync } from "node:fs";
import { execaSync } from "execa";
import type { BranchChangeFile, BranchChangeStats, WorkspaceChangeSet } from "./branch-conflicts-types.js";
import { canonicalPath } from "./branch-conflicts-worktrees.js";

export function collectWorkspaceChanges(
  repoPath: string,
  executionCwd: string,
  scope: "repo" | "execution" = "execution",
): WorkspaceChangeSet | null {
  const normalizedRepoPath = canonicalPath(repoPath);
  const normalizedExecutionPath = canonicalPath(executionCwd);
  const relativePath = toRelativeRepoPath(normalizedRepoPath, normalizedExecutionPath);
  if (relativePath === null) return null;

  const statusArgs = ["status", "--porcelain=v1", "-z", "--untracked-files=all"];
  if (relativePath !== ".") {
    statusArgs.push("--", relativePath);
  }
  const { stdout } = execaSync("git", statusArgs, { cwd: normalizedRepoPath });
  const files = parseWorkspaceStatus(stdout);
  if (files.length === 0) {
    return {
      scope,
      executionCwd: normalizedExecutionPath,
      relativePath,
      diffStats: { filesChanged: 0, insertions: 0, deletions: 0 },
      files: [],
      paths: [],
    };
  }

  const diffStats = collectWorkspaceDiffStats(normalizedRepoPath, relativePath, files);

  return {
    scope,
    executionCwd: normalizedExecutionPath,
    relativePath,
    diffStats,
    files,
    paths: files.map((file) => file.path),
  };
}

function parseWorkspaceStatus(output: string): BranchChangeFile[] {
  const entries = output.split("\0");
  const files: BranchChangeFile[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) continue;

    const statusCode = entry.slice(0, 2);
    const path = entry.slice(3);
    if (!path) continue;

    const status = mapWorkspaceStatus(statusCode);
    let previousPath: string | null = null;

    if (status === "Renamed" || status === "Copied") {
      previousPath = entries[index + 1] || null;
      index += 1;
    }

    files.push({
      path,
      previousPath,
      status,
      oldOid: null,
      newOid: null,
      binary: false,
    });
  }

  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

function mapWorkspaceStatus(statusCode: string): BranchChangeFile["status"] {
  const normalized = statusCode.replaceAll(" ", "");
  if (normalized === "??") return "Untracked";
  if (normalized.includes("U")) return "Conflicted";
  if (normalized.includes("R")) return "Renamed";
  if (normalized.includes("C")) return "Copied";
  if (normalized.includes("A")) return "Added";
  if (normalized.includes("D")) return "Deleted";
  if (normalized.includes("T")) return "Typechange";
  return "Modified";
}

function collectWorkspaceDiffStats(
  repoPath: string,
  relativePath: string,
  files: BranchChangeFile[],
): BranchChangeStats {
  const diffArgs = ["diff", "--numstat", "HEAD"];
  if (relativePath !== ".") {
    diffArgs.push("--", relativePath);
  }
  const { stdout } = execaSync("git", diffArgs, { cwd: repoPath, reject: false });
  const stats = stdout.split(/\r?\n/).filter(Boolean).reduce((acc, line) => {
    const [additionsRaw = "0", deletionsRaw = "0"] = line.split("\t");
    const additions = additionsRaw === "-" ? 0 : Number(additionsRaw);
    const deletions = deletionsRaw === "-" ? 0 : Number(deletionsRaw);
    return {
      insertions: acc.insertions + (Number.isFinite(additions) ? additions : 0),
      deletions: acc.deletions + (Number.isFinite(deletions) ? deletions : 0),
    };
  }, { insertions: 0, deletions: 0 });

  const untrackedStats = files.reduce((acc, file) => {
    if (file.status !== "Untracked") return acc;

    const filePath = `${repoPath}/${file.path}`;
    let insertions = 0;
    try {
      const content = readFileSync(filePath, "utf-8");
      insertions = countTextLines(content);
    } catch {
      insertions = 0;
    }

    return {
      insertions: acc.insertions + insertions,
      deletions: acc.deletions,
    };
  }, { insertions: 0, deletions: 0 });

  return {
    filesChanged: files.length,
    insertions: stats.insertions + untrackedStats.insertions,
    deletions: stats.deletions + untrackedStats.deletions,
  };
}

function countTextLines(content: string): number {
  if (content.length === 0) return 0;
  if (content.includes("\0")) return 0;
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").length;
  return normalized.endsWith("\n") ? lines - 1 : lines;
}

function toRelativeRepoPath(repoPath: string, executionCwd: string): string | null {
  if (executionCwd === repoPath) return ".";
  if (!executionCwd.startsWith(`${repoPath}/`)) return null;
  return executionCwd.slice(repoPath.length + 1);
}
