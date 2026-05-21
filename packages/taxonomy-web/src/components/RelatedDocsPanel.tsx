import { useEffect, useState } from "react";
import { parseRef } from "taxonomy-engine";
import { fetchRelatedDocs, type RelatedDoc } from "../data/relatedDocsApi";

export function RelatedDocsPanel({ selectedRef }: { selectedRef: string }) {
  const [docs, setDocs] = useState<RelatedDoc[]>([]);
  const term = (() => {
    try {
      const r = parseRef(selectedRef);
      if (r.kind === "entry") return r.entry;
      if (r.kind === "axis") return r.axis;
      if (r.kind === "relation") return r.relation;
      if (r.kind === "constraint") return r.constraint;
    } catch {
      return null;
    }
    return null;
  })();

  useEffect(() => {
    if (!term) {
      setDocs([]);
      return;
    }
    fetchRelatedDocs(term).then(setDocs);
  }, [term]);

  if (!term) return <div className="text-xs text-gray-500">term 없음</div>;
  if (docs.length === 0) return <div className="text-xs text-gray-500">검색 결과 없음</div>;

  return (
    <ul className="space-y-1 text-xs">
      {docs.map((d, i) => (
        <li key={i}>
          <div className="font-mono text-gray-600">{d.path}:{d.lineNumber}</div>
          <div className="text-gray-700">{d.snippet}</div>
        </li>
      ))}
    </ul>
  );
}
