import { useEffect, useState } from 'react';
import { fetchDecision, type DecisionResponse } from '../data/decisionApi';
import { LifecycleBadge } from './LifecycleBadge';

export function DecisionPanel({
  yamlFile,
  decisionLink,
}: {
  yamlFile: string;
  decisionLink: string;
}) {
  const [resp, setResp] = useState<DecisionResponse | null>(null);
  useEffect(() => {
    if (!yamlFile || !decisionLink) return;
    fetchDecision(yamlFile, decisionLink).then(setResp);
  }, [yamlFile, decisionLink]);

  if (!resp) return <div className="text-xs text-gray-500">decision 로딩 중...</div>;

  if (resp.kind === 'external') {
    return (
      <div className="text-xs text-gray-500">
        외부 link — 자체 표시 안 함 ({resp.reason})
        <div className="font-mono mt-1 break-all">{decisionLink}</div>
      </div>
    );
  }

  if (resp.kind === 'missing') {
    return (
      <div className="text-xs">
        <div className="text-amber-700">
          decision 파일 없음 — `qa-sdk decision sync`로 생성 가능
        </div>
        <div className="text-gray-500 font-mono mt-1 break-all">{resp.resolvedPath}</div>
      </div>
    );
  }

  const { file } = resp;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <LifecycleBadge value={file.meta.lifecycle} />
        <span className="font-mono text-gray-600 break-all">{file.meta.id}</span>
      </div>

      {file.markers.purpose && (
        <div>
          <div className="font-semibold text-gray-700">질문</div>
          <div className="text-gray-800">{file.markers.purpose}</div>
        </div>
      )}

      {file.markers.options.length > 0 && (
        <div>
          <div className="font-semibold text-gray-700">옵션 ({file.markers.options.length})</div>
          <ul className="space-y-0.5 ml-2">
            {file.markers.options.map((o, i) => (
              <li key={i}>
                <span className="font-mono text-blue-700">{o.id}</span>
                <span className="text-gray-600"> — {truncate(o.body, 80)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {file.markers.evidence.length > 0 && (
        <div>
          <div className="font-semibold text-gray-700">증거 ({file.markers.evidence.length})</div>
          <ul className="space-y-0.5 ml-2">
            {file.markers.evidence.map((e, i) => (
              <li key={i}>
                <span className="inline-block px-1.5 rounded bg-gray-100 text-gray-700 font-mono">
                  {e.kind}
                </span>
                <span className="text-gray-400 mx-1">w={e.weight}</span>
                <span className="text-gray-700">{truncate(e.content, 60)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {file.markers.outcome && (
        <div>
          <div className="font-semibold text-gray-700">결정</div>
          <div className="text-gray-800">{file.markers.outcome}</div>
        </div>
      )}

      <div className="text-gray-400 text-[10px] mt-2">updated {file.meta.updated}</div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
