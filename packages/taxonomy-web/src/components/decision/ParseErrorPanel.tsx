import { classifyParseError } from '../../lib/decisionDemo';

export function ParseErrorPanel({ message }: { message: string }) {
  const classified = classifyParseError(message);
  return (
    <div className="border border-red-300 bg-red-50 text-red-700 text-xs p-3 rounded">
      <div className="font-semibold mb-1">
        parse error
        <span className="ml-2 text-[10px] uppercase tracking-wide text-red-500">
          {classified.kind}
        </span>
      </div>
      <div className="font-mono text-red-800">{classified.message}</div>
      <div className="mt-1 text-red-600">💡 {classified.hint}</div>
    </div>
  );
}
