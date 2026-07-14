import type { UnknownMarker } from '../../lib/decisionDemo';

export function UnknownMarkersPanel({ markers }: { markers: UnknownMarker[] }) {
  if (markers.length === 0) return null;
  return (
    <div className="text-xs px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
      <div className="font-semibold mb-1">⚠ 알 수 없는 마커 {markers.length}건</div>
      <ul className="ml-3 list-disc">
        {markers.map((u, i) => (
          <li key={i} className="font-mono text-[11px]">
            {u.raw} <span className="text-amber-600">(line {u.line})</span>
          </li>
        ))}
      </ul>
      <div className="text-[10px] text-amber-600 mt-1">
        bridge가 무시합니다. 치트시트의 9 마커 중 하나를 사용하세요.
      </div>
    </div>
  );
}
