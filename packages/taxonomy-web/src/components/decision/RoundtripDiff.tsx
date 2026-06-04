import { useMemo } from "react";
import { lineDiff, diffStats, type DiffLine } from "../../lib/textDiff";

export function RoundtripDiff({
  original,
  regenerated,
}: {
  original: string;
  regenerated: string;
}) {
  const diff = useMemo(() => lineDiff(original, regenerated), [original, regenerated]);
  const stats = diffStats(diff);

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold text-gray-600 flex items-center gap-2">
        <span>↻ round-trip diff</span>
        <span className="text-green-700">+{stats.added}</span>
        <span className="text-red-700">−{stats.removed}</span>
        <span className="text-gray-400">={stats.same}</span>
      </div>
      <div className="border rounded bg-white max-h-64 overflow-auto font-mono text-[11px]">
        {diff.map((line, i) => (
          <DiffRow key={i} line={line} />
        ))}
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === "same") {
    return (
      <div className="flex">
        <Gutter text=" " bg="bg-white" />
        <pre className="flex-1 px-2 whitespace-pre-wrap text-gray-700">
          {line.text || " "}
        </pre>
      </div>
    );
  }
  if (line.kind === "add") {
    return (
      <div className="flex bg-green-50">
        <Gutter text="+" bg="bg-green-100 text-green-700" />
        <pre className="flex-1 px-2 whitespace-pre-wrap text-green-900">
          {line.text || " "}
        </pre>
      </div>
    );
  }
  return (
    <div className="flex bg-red-50">
      <Gutter text="−" bg="bg-red-100 text-red-700" />
      <pre className="flex-1 px-2 whitespace-pre-wrap text-red-900 line-through opacity-80">
        {line.text || " "}
      </pre>
    </div>
  );
}

function Gutter({ text, bg }: { text: string; bg: string }) {
  return (
    <span className={`w-5 text-center select-none ${bg}`}>{text}</span>
  );
}
