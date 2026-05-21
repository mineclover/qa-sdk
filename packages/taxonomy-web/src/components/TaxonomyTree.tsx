import type { StaticTaxonomy } from "../types/taxonomy";

export function TaxonomyTree({
  taxonomy,
  onSelectRef,
}: {
  taxonomy: StaticTaxonomy;
  onSelectRef: (ref: string) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <section>
        <h3 className="font-bold text-base mb-1">Axes ({Object.keys(taxonomy.axes).length})</h3>
        <ul className="space-y-1">
          {Object.entries(taxonomy.axes).map(([axisName, axis]) => (
            <li key={axisName}>
              <div
                className="font-mono text-blue-600 cursor-pointer hover:underline"
                onClick={() => onSelectRef(`${taxonomy.taxonomy}:${axisName}`)}
              >
                {axisName} ({axis.entries.length})
              </div>
              <ul className="ml-4 mt-0.5">
                {axis.entries.map((entry) => (
                  <li key={entry.id}>
                    <span
                      className="font-mono text-gray-700 cursor-pointer hover:underline"
                      onClick={() => onSelectRef(`${taxonomy.taxonomy}:${axisName}.${entry.id}`)}
                    >
                      {entry.id}
                    </span>
                    <span className="text-gray-400 ml-2">#{entry.address}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-bold text-base mb-1">Relations ({Object.keys(taxonomy.relations).length})</h3>
        <ul className="space-y-1">
          {Object.entries(taxonomy.relations).map(([relName, rel]) => (
            <li
              key={relName}
              className="font-mono text-purple-600 cursor-pointer hover:underline"
              onClick={() => onSelectRef(`${taxonomy.taxonomy}:relations/${relName}`)}
            >
              {relName} ({rel.kind}, {rel.rules.length} rules)
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-bold text-base mb-1">Constraints ({taxonomy.constraints.length})</h3>
        <ul className="space-y-1">
          {taxonomy.constraints.map((c) => (
            <li
              key={c.id}
              className="font-mono text-orange-600 cursor-pointer hover:underline"
              onClick={() => onSelectRef(`${taxonomy.taxonomy}:constraints/${c.id}`)}
            >
              {c.id} ({c.kind})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
