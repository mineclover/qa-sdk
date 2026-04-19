// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { realpathSync } from "node:fs";
import { basename, resolve as resolvePath } from "node:path";
import { execaSync } from "execa";
import type { GitWorktreeDescriptor } from "./branch-conflicts-types.js";

export function listGitWorktrees(cwd: string): GitWorktreeDescriptor[] {
  try {
    const { stdout } = execaSync("git", ["worktree", "list", "--porcelain"], { cwd });
    return parseGitWorktreeList(stdout);
  } catch {
    return [];
  }
}

export function parseGitWorktreeList(output: string): GitWorktreeDescriptor[] {
  const lines = output.split(/\r?\n/);
  const worktrees: GitWorktreeDescriptor[] = [];
  let current: Partial<GitWorktreeDescriptor> | null = null;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (isCompleteWorktree(current)) {
        worktrees.push(current);
      }
      current = {
        path: line.slice("worktree ".length),
        branchRef: null,
        isBare: false,
        isDetached: false,
      };
      continue;
    }

    if (!current || line.length === 0) continue;
    if (line.startsWith("HEAD ")) {
      current.headOid = line.slice("HEAD ".length);
      continue;
    }
    if (line.startsWith("branch ")) {
      current.branchRef = line.slice("branch ".length);
      continue;
    }
    if (line === "bare") {
      current.isBare = true;
      continue;
    }
    if (line === "detached") {
      current.isDetached = true;
    }
  }

  if (isCompleteWorktree(current)) {
    worktrees.push(current);
  }

  return worktrees;
}

export function normalizeRefName(ref: string): string {
  if (ref.startsWith("refs/remotes/")) {
    return ref.slice("refs/remotes/".length);
  }
  if (ref.startsWith("refs/heads/")) {
    return ref.slice("refs/heads/".length);
  }
  return ref;
}

export function buildWorktreeDisplayName(
  worktree: GitWorktreeDescriptor,
  branchName: string,
): string {
  if (worktree.isDetached) {
    return `worktree:${basename(worktree.path)}@${worktree.headOid.slice(0, 7)}`;
  }

  return `worktree:${branchName}`;
}

export function canonicalPath(path: string): string {
  const resolvedPath = resolvePath(path);
  try {
    return realpathSync.native(resolvedPath);
  } catch {
    return resolvedPath;
  }
}

function isCompleteWorktree(
  worktree: Partial<GitWorktreeDescriptor> | null,
): worktree is GitWorktreeDescriptor {
  return Boolean(worktree?.path && worktree.headOid);
}
