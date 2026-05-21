import type { DiffResult } from "taxonomy-engine";

export async function fetchGitDiff(file: string, base = "main"): Promise<DiffResult | null> {
  const params = new URLSearchParams({ file, base });
  const res = await fetch(`/api/git-diff?${params}`);
  if (!res.ok) return null;
  return res.json();
}
