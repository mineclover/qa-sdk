import { useEffect, useState } from "react";
import { fetchGitLog, type GitCommit } from "../data/gitLogApi";

export function GitLogPanel({ file, selectedRef }: { file: string; selectedRef: string }) {
  const [log, setLog] = useState<GitCommit[]>([]);
  useEffect(() => {
    fetchGitLog(file, selectedRef || undefined).then(setLog);
  }, [file, selectedRef]);

  if (log.length === 0) return <div className="text-xs text-gray-500">git log 없음</div>;

  return (
    <ul className="space-y-1 text-xs">
      {log.map((c) => (
        <li key={c.sha} className="border-l-2 border-gray-200 pl-2">
          <div>
            <span className="font-mono text-gray-500">{c.sha.slice(0, 7)}</span>
            <span className="ml-2">{c.subject}</span>
          </div>
          <div className="text-gray-400">
            {c.author} · {c.date.slice(0, 10)}
          </div>
        </li>
      ))}
    </ul>
  );
}
