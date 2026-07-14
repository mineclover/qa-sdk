import type { Lifecycle } from 'taxonomy-engine';
import type { StaticTaxonomy } from '../types/taxonomy';
import { LifecycleBadge } from './LifecycleBadge';

export function TaxonomyTree({
  taxonomy,
  onSelectRef,
  lifecycleFilter,
}: {
  taxonomy: StaticTaxonomy;
  onSelectRef: (ref: string) => void;
  /** 표시할 lifecycle 값 집합. undefined: 전체. */
  lifecycleFilter?: Set<Lifecycle | '_none'>;
}) {
  const matches = (lifecycle?: Lifecycle): boolean => {
    if (!lifecycleFilter || lifecycleFilter.size === 0) return true;
    const key = lifecycle ?? '_none';
    return lifecycleFilter.has(key);
  };

  return (
    <div className="space-y-3 text-sm">
      <section>
        <h3 className="font-bold text-base mb-1">Axes ({Object.keys(taxonomy.axes).length})</h3>
        <ul className="space-y-1">
          {Object.entries(taxonomy.axes).map(([axisName, axis]) => {
            const filteredEntries = axis.entries.filter((e) => matches(e.lifecycle));
            if (
              lifecycleFilter &&
              lifecycleFilter.size > 0 &&
              filteredEntries.length === 0 &&
              !matches(axis.lifecycle)
            ) {
              return null;
            }
            return (
              <li key={axisName}>
                <div
                  className="font-mono text-blue-600 cursor-pointer hover:underline flex items-center gap-1.5"
                  onClick={() => onSelectRef(`${taxonomy.taxonomy}:${axisName}`)}
                >
                  <span>
                    {axisName} ({axis.entries.length})
                  </span>
                  <LifecycleBadge value={axis.lifecycle} />
                </div>
                <ul className="ml-4 mt-0.5 space-y-0.5">
                  {filteredEntries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-gray-700 cursor-pointer hover:underline"
                        onClick={() => onSelectRef(`${taxonomy.taxonomy}:${axisName}.${entry.id}`)}
                      >
                        {entry.id}
                      </span>
                      <span className="text-gray-400">#{entry.address}</span>
                      <LifecycleBadge value={entry.lifecycle} title={entry.placeholderReason} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="font-bold text-base mb-1">
          Relations ({Object.keys(taxonomy.relations).length})
        </h3>
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
