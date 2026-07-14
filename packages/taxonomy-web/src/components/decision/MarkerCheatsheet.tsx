import { useState } from 'react';
import { MARKER_CHEATSHEET, type MarkerSpec } from '../../lib/decisionDemo';

const CATEGORY_LABEL: Record<MarkerSpec['category'], string> = {
  core: '필수 / 본문',
  evidence: '근거',
  flow: '흐름 메타',
  'multi-gate': 'Multi-gate',
  annotation: '옵션 평가',
};

export function MarkerCheatsheet() {
  const [open, setOpen] = useState(false);
  const grouped = groupByCategory(MARKER_CHEATSHEET);

  return (
    <div className="border rounded bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-2 py-1 text-xs font-semibold text-gray-700 flex items-center gap-1 hover:bg-gray-50"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>마커 치트시트</span>
        <span className="ml-auto text-gray-400 text-[10px]">{MARKER_CHEATSHEET.length}종</span>
      </button>
      {open && (
        <div className="px-2 py-2 border-t space-y-2 text-xs">
          {Object.entries(grouped).map(([cat, items]) => (
            <section key={cat}>
              <div className="font-semibold text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">
                {CATEGORY_LABEL[cat as MarkerSpec['category']]}
              </div>
              <table className="w-full">
                <tbody>
                  {items.map((m) => (
                    <tr key={m.syntax} className="align-top">
                      <td className="font-mono text-blue-700 pr-2 whitespace-nowrap py-0.5">
                        {m.syntax}
                      </td>
                      <td className="text-gray-700 py-0.5">
                        <div>{m.desc}</div>
                        <div className="font-mono text-gray-500 text-[11px]">{m.example}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByCategory(
  items: readonly MarkerSpec[],
): Record<MarkerSpec['category'], MarkerSpec[]> {
  const out: Record<MarkerSpec['category'], MarkerSpec[]> = {
    core: [],
    evidence: [],
    flow: [],
    'multi-gate': [],
    annotation: [],
  };
  for (const m of items) out[m.category].push(m);
  return out;
}
