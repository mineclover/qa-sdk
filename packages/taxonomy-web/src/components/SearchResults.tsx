import { useEffect, useState } from "react";
import type { SearchHit } from "../lib/searchIndex";
import { buildSearchIndex, searchHits } from "../lib/searchIndex";
import { loadTaxonomyIndex, loadTaxonomy } from "../data/loadStaticTaxonomies";
import { fetchFeedbacks } from "../data/feedbacksApi";

let cachedHits: SearchHit[] | null = null;

async function getHits(): Promise<SearchHit[]> {
  if (cachedHits) return cachedHits;
  const index = await loadTaxonomyIndex();
  const taxonomies = await Promise.all(
    index.taxonomies.map(async (idx) => ({ idx, data: await loadTaxonomy(idx.file) })),
  );
  const feedbacks = await fetchFeedbacks();
  cachedHits = buildSearchIndex(taxonomies, feedbacks);
  return cachedHits;
}

export function SearchResults({
  query,
  onClose,
  onNavigate,
}: {
  query: string;
  onClose: () => void;
  onNavigate: (target: { file?: string; ref?: string }) => void;
}) {
  const [results, setResults] = useState<SearchHit[]>([]);

  useEffect(() => {
    getHits().then((hits) => setResults(searchHits(hits, query)));
  }, [query]);

  if (results.length === 0) {
    return (
      <div className="absolute right-0 top-full mt-1 w-96 max-h-96 overflow-auto bg-white border rounded shadow-lg p-3 z-50 text-sm">
        결과 없음
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-96 max-h-96 overflow-auto bg-white border rounded shadow-lg z-50 text-sm">
      <ul className="divide-y">
        {results.map((h, i) => (
          <li
            key={i}
            className="p-2 cursor-pointer hover:bg-gray-50"
            onClick={() => {
              if (h.kind === "taxonomy") onNavigate({ file: h.file });
              if (h.kind === "axis") onNavigate({ ref: `${h.taxonomy}:${h.axis}` });
              if (h.kind === "entry") onNavigate({ ref: `${h.taxonomy}:${h.axis}.${h.entry}` });
              if (h.kind === "feedback") onNavigate({ ref: h.ref });
            }}
          >
            <div className="text-xs text-gray-500">{h.kind}</div>
            <div className="font-mono">
              {h.kind === "taxonomy" && h.name}
              {h.kind === "axis" && `${h.taxonomy}:${h.axis} (${h.entriesCount})`}
              {h.kind === "entry" && `${h.taxonomy}:${h.axis}.${h.entry}`}
              {h.kind === "feedback" && h.ref}
            </div>
            {h.kind === "entry" && h.label && <div className="text-xs text-gray-600">{h.label}</div>}
            {h.kind === "feedback" && <div className="text-xs text-gray-600 truncate">{h.text}</div>}
            {h.kind === "taxonomy" && h.description && <div className="text-xs text-gray-600 truncate">{h.description}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
