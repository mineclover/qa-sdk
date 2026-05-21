import type { DecisionFile } from "taxonomy-decision-bridge";

export type DecisionResponse =
  | { kind: "found"; file: DecisionFile }
  | { kind: "missing"; resolvedPath: string }
  | { kind: "external"; reason: string };

export async function fetchDecision(
  yamlFile: string,
  decisionLink: string,
): Promise<DecisionResponse | null> {
  const params = new URLSearchParams({ yamlFile, decisionLink });
  const res = await fetch(`/api/decision?${params}`);
  if (!res.ok) return null;
  return res.json();
}
