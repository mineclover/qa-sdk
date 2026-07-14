import type { EvidenceFanout } from '../../lib/decisionDemo';

export function EvidenceFanoutWarning({ fanout }: { fanout: EvidenceFanout }) {
  if (!fanout.hasDuplicationRisk) return null;
  return (
    <div className="text-xs px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
      <div className="font-semibold mb-1">⚠ round-trip 시 evidence 중복 가능</div>
      <div className="text-amber-700">
        같은 evidence kind를 여러 gate가 요구 — `toMarkdown` 재생성 시 동일 evidence가 각 gate에
        복제됩니다.
      </div>
      <ul className="mt-1 ml-3 list-disc text-amber-700">
        {fanout.duplicatedKinds.map((d) => (
          <li key={d.kind} className="font-mono text-[11px]">
            {d.kind} → {d.gates.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}
