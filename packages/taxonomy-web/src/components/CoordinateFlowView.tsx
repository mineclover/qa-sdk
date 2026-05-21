import { useMemo } from "react";
import { parseRef } from "taxonomy-engine";
import type { StaticTaxonomy } from "../types/taxonomy";

export function CoordinateFlowView({
  selectedRef,
  taxonomy,
  onSelectRef,
}: {
  selectedRef: string;
  taxonomy: StaticTaxonomy;
  onSelectRef: (ref: string) => void;
}) {
  const flows = useMemo(() => {
    let ref;
    try { ref = parseRef(selectedRef); } catch { return []; }
    if (ref.kind !== "entry") return [];

    // 선택 entry가 등장하는 모든 relation rule에서 출발 → 도달 가능 좌표
    const result: Array<{ relation: string; via: string; reachable: Array<Record<string, string>> }> = [];
    for (const [relName, rel] of Object.entries(taxonomy.relations)) {
      // 시작 좌표가 이 relation 안에 있는지
      const startCoord: Record<string, string> = { [ref.axis]: ref.entry };
      // 부분좌표 매칭: rule이 startCoord의 모든 key-value를 포함하면 호환
      const visited = new Set<string>();
      const stack: Array<Record<string, string>> = [startCoord];
      const reachable: Array<Record<string, string>> = [];

      while (stack.length > 0) {
        const cur = stack.pop()!;
        const key = Object.entries(cur).sort().map(([k, v]) => `${k}=${v}`).join("|");
        if (visited.has(key)) continue;
        visited.add(key);
        reachable.push(cur);

        for (const rule of rel.rules) {
          // cur의 모든 key-value가 rule에 일치하는가
          const compatible = Object.entries(cur).every(([k, v]) => rule[k] === v);
          if (!compatible) continue;
          const next: Record<string, string> = { ...rule };
          const nextKey = Object.entries(next).sort().map(([k, v]) => `${k}=${v}`).join("|");
          if (!visited.has(nextKey)) stack.push(next);
        }
      }

      if (reachable.length > 1) {
        result.push({
          relation: relName,
          via: rel.kind,
          reachable: reachable.slice(1),  // 시작점 제외
        });
      }
    }
    return result;
  }, [selectedRef, taxonomy]);

  if (flows.length === 0) {
    return <div className="text-xs text-gray-500">cross-axis 흐름 없음 (선택 entry가 등장하는 relation에서 다른 좌표로 연결되지 않음)</div>;
  }

  return (
    <ul className="space-y-2 text-xs">
      {flows.map((f) => (
        <li key={f.relation} className="border-l-2 border-purple-200 pl-2">
          <div className="font-mono text-purple-700">{f.relation} ({f.via})</div>
          <ul className="ml-2 mt-1 space-y-0.5">
            {f.reachable.map((coord, i) => {
              const display = Object.entries(coord).map(([k, v]) => `${k}=${v}`).join(", ");
              // entry 좌표면 클릭 가능
              const isSingle = Object.keys(coord).length === 1;
              const ref = isSingle
                ? `${taxonomy.taxonomy}:${Object.keys(coord)[0]}.${Object.values(coord)[0]}`
                : null;
              return (
                <li key={i}>
                  {ref ? (
                    <button className="font-mono text-blue-600 hover:underline" onClick={() => onSelectRef(ref)}>
                      {display}
                    </button>
                  ) : (
                    <span className="font-mono text-gray-600">{display}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
