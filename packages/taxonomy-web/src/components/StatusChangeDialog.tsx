import { useState } from "react";
import type { Feedback, FeedbackStatus } from "../types/feedback";
import { patchFeedbackStatus } from "../data/feedbacksApi";

export function StatusChangeDialog({
  feedback,
  newStatus,
  onClose,
  onChanged,
}: {
  feedback: Feedback;
  newStatus: FeedbackStatus;
  onClose: () => void;
  onChanged: (updated: Feedback) => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const updated = await patchFeedbackStatus(feedback.id, newStatus, feedback.status, note || undefined);
      onChanged(updated);
      onClose();
    } catch (e) {
      alert(`상태 변경 실패: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 max-w-md w-full space-y-3">
        <h3 className="font-bold">상태 변경: {feedback.status} → {newStatus}</h3>
        <p className="text-sm text-gray-600">{feedback.ref}</p>
        <textarea
          className="w-full border px-2 py-1 rounded text-sm"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="변경 사유 (선택)"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded text-sm">취소</button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
