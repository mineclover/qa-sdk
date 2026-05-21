import { parseRef } from "taxonomy-engine";
import type { StaticTaxonomy } from "../types/taxonomy";

export function UnitDetailPanel({
  selectedRef,
  taxonomy,
}: {
  selectedRef: string;
  taxonomy: StaticTaxonomy;
}) {
  if (!selectedRef) {
    return <div className="text-sm text-gray-500">단위 선택 시 상세 정보가 표시됩니다</div>;
  }

  let ref;
  try {
    ref = parseRef(selectedRef);
  } catch {
    return <div className="text-sm text-red-600">잘못된 ref 형식</div>;
  }

  if (ref.kind === "axis") {
    const axis = taxonomy.axes[ref.axis];
    if (!axis) return <div className="text-sm text-red-600">axis 없음: {ref.axis}</div>;
    return (
      <div className="space-y-1 text-sm">
        <div className="font-mono text-blue-700">{taxonomy.taxonomy}:{ref.axis}</div>
        {axis.description && <p className="text-gray-700">{axis.description}</p>}
        <dl className="grid grid-cols-2 gap-x-2 text-xs">
          <dt className="text-gray-500">entries</dt>
          <dd>{axis.entries.length}</dd>
          <dt className="text-gray-500">capacity</dt>
          <dd>{axis.capacity}</dd>
          <dt className="text-gray-500">version</dt>
          <dd>{axis.version}</dd>
        </dl>
      </div>
    );
  }

  if (ref.kind === "entry") {
    const axis = taxonomy.axes[ref.axis];
    const entry = axis?.entries.find((e) => e.id === ref.entry);
    if (!entry) return <div className="text-sm text-red-600">entry 없음: {ref.entry}</div>;
    return (
      <div className="space-y-2 text-sm">
        <div className="font-mono text-blue-700">{taxonomy.taxonomy}:{ref.axis}.{ref.entry}</div>
        {entry.label && <p className="text-gray-700">{entry.label}</p>}
        <dl className="grid grid-cols-2 gap-x-2 text-xs">
          <dt className="text-gray-500">id</dt>
          <dd className="font-mono">{entry.id}</dd>
          <dt className="text-gray-500">address</dt>
          <dd className="font-mono">#{entry.address}</dd>
          <dt className="text-gray-500">소속 axis</dt>
          <dd className="font-mono">{ref.axis}</dd>
        </dl>
        {entry.meta && Object.keys(entry.meta).length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer">meta</summary>
            <pre className="bg-gray-50 p-2 mt-1 rounded overflow-auto">
              {JSON.stringify(entry.meta, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  if (ref.kind === "relation") {
    const rel = taxonomy.relations[ref.relation];
    if (!rel) return <div className="text-sm text-red-600">relation 없음</div>;
    return (
      <div className="space-y-2 text-sm">
        <div className="font-mono text-purple-700">relations/{ref.relation}</div>
        <dl className="grid grid-cols-2 gap-x-2 text-xs">
          <dt className="text-gray-500">kind</dt>
          <dd>{rel.kind}</dd>
          <dt className="text-gray-500">from</dt>
          <dd className="font-mono">{rel.from.join(", ")}</dd>
          <dt className="text-gray-500">to</dt>
          <dd className="font-mono">{rel.to.join(", ")}</dd>
          <dt className="text-gray-500">rules</dt>
          <dd>{rel.rules.length}</dd>
        </dl>
      </div>
    );
  }

  if (ref.kind === "constraint") {
    const c = taxonomy.constraints.find((x) => x.id === ref.constraint);
    if (!c) return <div className="text-sm text-red-600">constraint 없음</div>;
    return (
      <div className="space-y-2 text-sm">
        <div className="font-mono text-orange-700">constraints/{c.id}</div>
        <dl className="grid grid-cols-2 gap-x-2 text-xs">
          <dt className="text-gray-500">kind</dt>
          <dd>{c.kind}</dd>
          <dt className="text-gray-500">severity</dt>
          <dd>{c.severity}</dd>
        </dl>
        <details>
          <summary className="cursor-pointer text-xs">rule</summary>
          <pre className="bg-gray-50 p-2 mt-1 rounded overflow-auto text-xs">
            {typeof c.rule === "string" ? c.rule : JSON.stringify(c.rule, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return <div className="text-sm text-gray-500">kind={ref.kind}: 지원 안 함</div>;
}
