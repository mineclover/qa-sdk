import { parseRef } from 'taxonomy-engine';
import type { StaticTaxonomy } from '../types/taxonomy';

export function RelatedConstraintsPanel({
  selectedRef,
  taxonomy,
}: {
  selectedRef: string;
  taxonomy: StaticTaxonomy;
}) {
  let ref;
  try {
    ref = parseRef(selectedRef);
  } catch {
    return null;
  }
  if (ref.kind !== 'axis' && ref.kind !== 'entry') return null;

  const matches = taxonomy.constraints.filter((c) => {
    const ruleStr = typeof c.rule === 'string' ? c.rule : JSON.stringify(c.rule);
    if (ref.kind === 'axis') return ruleStr.includes(ref.axis);
    if (ref.kind === 'entry') return ruleStr.includes(ref.entry);
    return false;
  });

  if (matches.length === 0) {
    return <div className="text-xs text-gray-500">관련 constraints 없음</div>;
  }

  return (
    <ul className="space-y-1 text-xs">
      {matches.map((c) => (
        <li key={c.id} className="font-mono">
          <span className="text-orange-700">{c.id}</span> ({c.kind}, {c.severity})
        </li>
      ))}
    </ul>
  );
}
