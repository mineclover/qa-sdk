import { useEffect, useState } from "react";
import type { TaxonomyIndex } from "../types/taxonomy";
import { loadTaxonomyIndex } from "../data/loadStaticTaxonomies";

export function TaxonomyListPage({ onSelect }: { onSelect: (file: string) => void }) {
  const [index, setIndex] = useState<TaxonomyIndex | null>(null);

  useEffect(() => {
    loadTaxonomyIndex().then(setIndex);
  }, []);

  if (!index) return <div>로딩 중...</div>;

  return (
    <ul className="space-y-2">
      {index.taxonomies.map((t) => (
        <li
          key={t.name}
          className="border rounded p-2 cursor-pointer hover:bg-gray-50"
          onClick={() => onSelect(t.file)}
        >
          <div className="font-mono text-blue-700">{t.name}</div>
          <div className="text-xs text-gray-600">
            v{t.version} · axes={t.axesCount} · relations={t.relationsCount} · constraints={t.constraintsCount}
          </div>
        </li>
      ))}
    </ul>
  );
}
