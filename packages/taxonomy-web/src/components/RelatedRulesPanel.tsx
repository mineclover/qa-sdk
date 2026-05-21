import { parseRef } from "taxonomy-engine";
import type { StaticTaxonomy } from "../types/taxonomy";

export function RelatedRulesPanel({
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
  if (ref.kind !== "entry" && ref.kind !== "axis") return null;

  const matches: Array<{ relation: string; ruleIdx: number; rule: Record<string, string> }> = [];
  for (const [relName, rel] of Object.entries(taxonomy.relations)) {
    rel.rules.forEach((rule, idx) => {
      const values = Object.values(rule);
      if (ref.kind === "entry" && values.includes(ref.entry)) {
        matches.push({ relation: relName, ruleIdx: idx, rule });
      } else if (ref.kind === "axis") {
        if (rel.from.includes(ref.axis) || rel.to.includes(ref.axis)) {
          matches.push({ relation: relName, ruleIdx: idx, rule });
        }
      }
    });
  }

  if (matches.length === 0) {
    return <div className="text-xs text-gray-500">관련 relation rules 없음</div>;
  }

  return (
    <ul className="space-y-1 text-xs">
      {matches.map((m, i) => (
        <li key={i} className="font-mono">
          <span className="text-purple-700">{m.relation}#{m.ruleIdx}</span>{" "}
          <span className="text-gray-600">{JSON.stringify(m.rule)}</span>
        </li>
      ))}
    </ul>
  );
}
