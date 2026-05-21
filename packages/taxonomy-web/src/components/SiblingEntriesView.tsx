import { parseRef } from "taxonomy-engine";
import type { StaticTaxonomy } from "../types/taxonomy";

export function SiblingEntriesView({
  selectedRef,
  taxonomy,
  onSelectRef,
}: {
  selectedRef: string;
  taxonomy: StaticTaxonomy;
  onSelectRef: (ref: string) => void;
}) {
  let ref;
  try {
    ref = parseRef(selectedRef);
  } catch {
    return null;
  }
  if (ref.kind !== "entry") return null;

  const axis = taxonomy.axes[ref.axis];
  if (!axis) return null;
  const siblings = axis.entries.filter((e) => e.id !== ref.entry);

  if (siblings.length === 0) {
    return <div className="text-xs text-gray-500">형제 없음</div>;
  }

  return (
    <ul className="space-y-0.5 text-xs">
      {siblings.map((e) => (
        <li key={e.id}>
          <button
            className="font-mono text-blue-600 hover:underline"
            onClick={() => onSelectRef(`${taxonomy.taxonomy}:${ref.axis}.${e.id}`)}
          >
            {e.id}
          </button>
          <span className="text-gray-400 ml-2">#{e.address}</span>
        </li>
      ))}
    </ul>
  );
}
