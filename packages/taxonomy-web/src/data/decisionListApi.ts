/**
 * decision-list-api Vite plugin client.
 */

export type DecisionListItem = {
  id: string;
  fileName: string;
  lifecycle: string;
  subject: string;
  updated: string;
  mtime: number;
};

export async function fetchDecisionList(): Promise<DecisionListItem[]> {
  const res = await fetch("/api/decision-list");
  if (!res.ok) throw new Error(`decision-list ${res.status}`);
  const data = (await res.json()) as { items: DecisionListItem[] };
  return data.items;
}

export async function fetchDecisionFile(fileName: string): Promise<string> {
  const res = await fetch(
    `/api/decision-file?fileName=${encodeURIComponent(fileName)}`,
  );
  if (!res.ok) throw new Error(`decision-file ${res.status}`);
  return res.text();
}
