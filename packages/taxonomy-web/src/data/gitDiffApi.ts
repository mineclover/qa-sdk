import type { DiffResult, MigrationPlan } from "taxonomy-engine";

export type GitDiffResponse = {
  diff: DiffResult;
  migration: MigrationPlan;
};

export async function fetchGitDiff(
  file: string,
  base = "main",
): Promise<GitDiffResponse | null> {
  const params = new URLSearchParams({ file, base });
  const res = await fetch(`/api/git-diff?${params}`);
  if (!res.ok) return null;
  return res.json();
}
