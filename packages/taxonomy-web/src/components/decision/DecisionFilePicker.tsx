import { useEffect, useState } from "react";
import {
  fetchDecisionList,
  fetchDecisionFile,
  type DecisionListItem,
} from "../../data/decisionListApi";

export function DecisionFilePicker({
  onLoad,
}: {
  onLoad: (markdown: string, item: DecisionListItem) => void;
}) {
  const [items, setItems] = useState<DecisionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items !== null) return;
    fetchDecisionList()
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [open, items]);

  async function load(item: DecisionListItem) {
    setLoading(item.fileName);
    try {
      const text = await fetchDecisionFile(item.fileName);
      onLoad(text, item);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
      >
        📂 파일에서 로드
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border rounded shadow-lg w-80 max-h-72 overflow-auto">
          {error && (
            <div className="px-2 py-1 text-xs text-red-700 bg-red-50">
              {error}
            </div>
          )}
          {!items && !error && (
            <div className="px-2 py-2 text-xs text-gray-500">로딩...</div>
          )}
          {items && items.length === 0 && (
            <div className="px-2 py-2 text-xs text-gray-500">
              docs/decisions/ 에 파일 없음
            </div>
          )}
          {items?.map((item) => (
            <button
              key={item.fileName}
              onClick={() => load(item)}
              disabled={loading === item.fileName}
              className="block w-full text-left px-2 py-1.5 hover:bg-blue-50 text-xs border-b last:border-b-0 disabled:opacity-50"
            >
              <div className="font-mono text-blue-700">{item.id}</div>
              <div className="text-gray-600 text-[11px]">{item.subject}</div>
              <div className="text-gray-400 text-[10px]">
                {item.lifecycle} · {item.fileName}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
