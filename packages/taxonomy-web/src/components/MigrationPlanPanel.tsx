import type { MigrationPlan } from "taxonomy-engine";

export function MigrationPlanPanel({ plan }: { plan: MigrationPlan }) {
  const isEmpty =
    plan.idRenames.length === 0 &&
    plan.addressConflicts.length === 0 &&
    plan.manualReview.length === 0;

  if (isEmpty) {
    return <div className="text-xs text-gray-500">마이그레이션 필요 없음</div>;
  }

  return (
    <div className="space-y-2 text-xs">
      {plan.idRenames.length > 0 && (
        <section>
          <div className="font-semibold text-gray-700 mb-1">
            id renames ({plan.idRenames.length})
          </div>
          <ul className="space-y-0.5 ml-2">
            {plan.idRenames.map((r, i) => (
              <li key={i} className="font-mono">
                <span className="text-gray-500">{r.axis}</span>{" "}
                <span className="text-gray-400">#{r.address}</span>{" "}
                <span className="text-red-600">{r.fromId}</span>{" "}
                <span className="text-gray-400">→</span>{" "}
                <span className="text-green-700">{r.toId}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.addressConflicts.length > 0 && (
        <section>
          <div className="font-semibold text-red-700 mb-1">
            address conflicts ({plan.addressConflicts.length})
          </div>
          <ul className="space-y-0.5 ml-2">
            {plan.addressConflicts.map((c, i) => (
              <li key={i} className="font-mono">
                <span className="text-gray-500">{c.axis}</span>{" "}
                <span className="text-gray-400">#{c.address}</span>{" "}
                <span>[{c.ids.join(", ")}]</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.manualReview.length > 0 && (
        <section>
          <div className="font-semibold text-amber-700 mb-1">
            manual review ({plan.manualReview.length})
          </div>
          <ul className="space-y-0.5 ml-2 list-disc list-inside">
            {plan.manualReview.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
