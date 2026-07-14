import type { GateCycle } from '../../lib/decisionDemo';

export function CycleWarning({ cycles }: { cycles: GateCycle[] }) {
  if (cycles.length === 0) return null;
  return (
    <div className="text-xs px-3 py-2 rounded bg-red-50 border border-red-300 text-red-800">
      <div className="font-semibold mb-1">⚠ 의존성 사이클 {cycles.length}건 감지</div>
      <ul className="ml-3 list-disc">
        {cycles.map((c, i) => (
          <li key={i} className="font-mono text-[11px]">
            {c.nodes.length === 1
              ? `${c.nodes[0]} → ${c.nodes[0]} (self-loop)`
              : `${c.nodes.join(' → ')} → ${c.nodes[0]}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
