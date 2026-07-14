import { useState } from 'react';
import type { Feedback, FeedbackStatus } from '../types/feedback';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackList } from './FeedbackList';
import { StatusChangeDialog } from './StatusChangeDialog';

export function FeedbackPanel({
  selectedRef,
  feedbacks,
  onChanged,
}: {
  selectedRef: string;
  feedbacks: Feedback[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [pendingStatus, setPendingStatus] = useState<FeedbackStatus | null>(null);

  const refFeedbacks = feedbacks.filter((f) => f.ref === selectedRef);

  if (!selectedRef) {
    return <div className="text-sm text-gray-500">왼쪽에서 axis/entry를 선택하세요</div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-bold text-base mb-2">피드백 ({refFeedbacks.length})</h3>
        <FeedbackList items={refFeedbacks} onSelect={setSelected} />
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">새 피드백</h3>
        <FeedbackForm initialRef={selectedRef} onSubmitted={() => onChanged()} />
      </div>

      {selected && (
        <div className="border rounded p-3 space-y-2">
          <h4 className="font-bold text-sm">선택: {selected.id}</h4>
          <p className="text-sm">{selected.text}</p>
          <div className="flex gap-2">
            {selected.status !== 'resolved' && (
              <button
                className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                onClick={() => setPendingStatus('resolved')}
              >
                Resolve
              </button>
            )}
            {selected.status !== 'rejected' && (
              <button
                className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
                onClick={() => setPendingStatus('rejected')}
              >
                Reject
              </button>
            )}
            {selected.status !== 'open' && (
              <button
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                onClick={() => setPendingStatus('open')}
              >
                Re-open
              </button>
            )}
          </div>
          {selected.history.length > 0 && (
            <details className="text-xs text-gray-600">
              <summary>이력 ({selected.history.length})</summary>
              <ul className="ml-2 mt-1 space-y-1">
                {selected.history.map((h, i) => (
                  <li key={i}>
                    {h.at.slice(0, 19)}: {h.from} → {h.to}
                    {h.note && <span className="ml-2">({h.note})</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {selected && pendingStatus && (
        <StatusChangeDialog
          feedback={selected}
          newStatus={pendingStatus}
          onClose={() => setPendingStatus(null)}
          onChanged={(updated) => {
            setSelected(updated);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
