import { useEffect, useState } from "react";
import type { DiffResult } from "taxonomy-engine";
import { fetchGitDiff } from "../data/gitDiffApi";

export function DiffContextPanel({ file }: { file: string }) {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  useEffect(() => {
    fetchGitDiff(file).then(setDiff);
  }, [file]);

  if (!diff) return <div className="text-xs text-gray-500">diff 정보 없음</div>;
  if (diff.same) return <div className="text-xs text-green-600">main 대비 변경 없음</div>;

  return (
    <ul className="space-y-1 text-xs">
      {diff.changes.map((c, i) => (
        <li key={i} className="font-mono">
          {c.kind}: {JSON.stringify(c).slice(0, 80)}
        </li>
      ))}
    </ul>
  );
}
