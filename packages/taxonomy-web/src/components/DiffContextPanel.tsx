import { useEffect, useState } from 'react';
import { fetchGitDiff, type GitDiffResponse } from '../data/gitDiffApi';
import { BreakingLevelBadge } from './BreakingLevelBadge';
import { MigrationPlanPanel } from './MigrationPlanPanel';

export function DiffContextPanel({ file }: { file: string }) {
  const [resp, setResp] = useState<GitDiffResponse | null>(null);
  useEffect(() => {
    fetchGitDiff(file).then(setResp);
  }, [file]);

  if (!resp) return <div className="text-xs text-gray-500">diff 정보 없음</div>;
  const { diff, migration } = resp;

  if (diff.same) {
    return (
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <BreakingLevelBadge value="none" />
          <span className="text-green-600">main 대비 변경 없음</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-1.5">
        <BreakingLevelBadge value={diff.breakingLevel} />
        <span className="text-gray-500">{diff.changes.length} 변경</span>
      </div>
      <ul className="space-y-0.5">
        {diff.changes.slice(0, 20).map((c, i) => (
          <li key={i} className="font-mono">
            <span className="text-gray-500">{c.kind}</span>
          </li>
        ))}
        {diff.changes.length > 20 && (
          <li className="text-gray-400">... +{diff.changes.length - 20} more</li>
        )}
      </ul>
      <div className="border-t pt-2">
        <div className="font-semibold text-gray-700 mb-1">Migration Plan</div>
        <MigrationPlanPanel plan={migration} />
      </div>
    </div>
  );
}
