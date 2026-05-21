export type RelatedDoc = {
  path: string;
  lineNumber: number;
  snippet: string;
};

export async function fetchRelatedDocs(term: string): Promise<RelatedDoc[]> {
  const res = await fetch(`/api/related-docs?term=${encodeURIComponent(term)}`);
  if (!res.ok) return [];
  return res.json();
}
