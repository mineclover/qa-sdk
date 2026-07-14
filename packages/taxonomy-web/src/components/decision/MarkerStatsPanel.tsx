import type { MarkerStats } from '../../lib/decisionDemo';

export function MarkerStatsPanel({ stats }: { stats: MarkerStats }) {
  const maxKind = Math.max(1, ...Object.values(stats.evidenceByKind));
  const sortedKinds = Object.entries(stats.evidenceByKind).sort((a, b) => b[1] - a[1]);

  return (
    <section className="border rounded p-2 bg-white">
      <h3 className="text-xs font-semibold text-gray-600 mb-1">통계</h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <Row label="gates" value={stats.gateCount} />
        <Row label="options" value={stats.totalOptions} />
        <Row label="evidence" value={stats.totalEvidence} />
        <Row label="outcome" value={stats.hasOutcome ? '있음' : '없음'} />
      </div>
      {stats.phasesUsed.length > 0 && (
        <div className="mt-1.5 text-xs">
          <div className="text-gray-500 text-[10px] uppercase tracking-wide">phases</div>
          <div className="font-mono text-gray-700">{stats.phasesUsed.join(' · ')}</div>
        </div>
      )}
      {sortedKinds.length > 0 && (
        <div className="mt-1.5">
          <div className="text-gray-500 text-[10px] uppercase tracking-wide">evidence by kind</div>
          <div className="space-y-0.5 mt-0.5">
            {sortedKinds.map(([kind, n]) => (
              <div key={kind} className="flex items-center gap-2 text-xs">
                <span className="font-mono w-20 text-gray-700">{kind}</span>
                <div className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                  <div
                    className="bg-green-400 h-full"
                    style={{ width: `${(n / maxKind) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-gray-600 w-4 text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <span className="text-gray-500 font-mono text-[11px]">{label}</span>
      <span className="text-gray-800 font-mono">{value}</span>
    </>
  );
}
