import type { StaticTaxonomy, TaxonomyIndex } from "../types/taxonomy";
import type { Feedback } from "../types/feedback";

export type SearchHit =
  | { kind: "taxonomy"; name: string; file: string; description?: string }
  | { kind: "axis"; taxonomy: string; axis: string; entriesCount: number }
  | { kind: "entry"; taxonomy: string; axis: string; entry: string; label?: string }
  | { kind: "feedback"; id: string; ref: string; text: string };

export function buildSearchIndex(
  taxonomies: Array<{ idx: TaxonomyIndex["taxonomies"][number]; data: StaticTaxonomy }>,
  feedbacks: Feedback[],
): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const { idx, data } of taxonomies) {
    hits.push({ kind: "taxonomy", name: data.taxonomy, file: idx.file, description: data.description });
    for (const [axisName, axis] of Object.entries(data.axes)) {
      hits.push({ kind: "axis", taxonomy: data.taxonomy, axis: axisName, entriesCount: axis.entries.length });
      for (const entry of axis.entries) {
        hits.push({ kind: "entry", taxonomy: data.taxonomy, axis: axisName, entry: entry.id, label: entry.label });
      }
    }
  }

  for (const f of feedbacks) {
    hits.push({ kind: "feedback", id: f.id, ref: f.ref, text: f.text });
  }

  return hits;
}

export function searchHits(hits: SearchHit[], query: string, max = 30): SearchHit[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return hits
    .filter((h) => {
      if (h.kind === "taxonomy") return h.name.toLowerCase().includes(q) || h.description?.toLowerCase().includes(q);
      if (h.kind === "axis") return h.axis.toLowerCase().includes(q);
      if (h.kind === "entry") return h.entry.toLowerCase().includes(q) || h.label?.toLowerCase().includes(q);
      if (h.kind === "feedback") return h.ref.toLowerCase().includes(q) || h.text.toLowerCase().includes(q);
      return false;
    })
    .slice(0, max);
}
