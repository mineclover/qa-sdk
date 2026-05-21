export type GitCommit = {
  sha: string;
  author: string;
  date: string;
  subject: string;
};

export async function fetchGitLog(file: string, ref?: string): Promise<GitCommit[]> {
  const params = new URLSearchParams({ file });
  if (ref) params.set("ref", ref);
  const res = await fetch(`/api/git-log?${params}`);
  if (!res.ok) return [];
  return res.json();
}
