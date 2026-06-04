import { useEffect, useState } from "react";
import type { Feedback, FeedbackTag } from "../types/feedback";
import { FEEDBACK_TAGS } from "../types/feedback";
import { newFeedbackId } from "../lib/newFeedbackId";
import { isValidRef } from "../lib/refFormat";
import { postFeedback } from "../data/feedbacksApi";

export function FeedbackForm({
  initialRef,
  onSubmitted,
}: {
  initialRef?: string;
  onSubmitted?: (feedback: Feedback) => void;
}) {
  const [ref, setRef] = useState(initialRef ?? "");
  useEffect(() => {
    setRef(initialRef ?? "");
  }, [initialRef]);
  const [tag, setTag] = useState<FeedbackTag>("improvement");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidRef(ref)) {
      setError("잘못된 ref 형식");
      return;
    }
    if (text.trim().length === 0) {
      setError("내용 필수");
      return;
    }
    setSubmitting(true);
    const now = new Date().toISOString();
    const feedback: Feedback = {
      id: newFeedbackId(),
      ref,
      tag,
      status: "open",
      text: text.trim(),
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    try {
      const created = await postFeedback(feedback);
      onSubmitted?.(created);
      setText("");
    } catch (e) {
      setError(`전송 실패: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 border rounded">
      <div>
        <label className="text-sm text-gray-600">ref</label>
        <input
          className="w-full border px-2 py-1 rounded text-sm font-mono"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="taxonomy:axis.entry"
        />
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-sm text-gray-600">tag</label>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value as FeedbackTag)}
          className="border px-2 py-1 rounded text-sm"
        >
          {FEEDBACK_TAGS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <textarea
        className="w-full border px-2 py-1 rounded text-sm"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="피드백 내용..."
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={submitting}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400"
      >
        {submitting ? "전송 중..." : "피드백 작성"}
      </button>
    </form>
  );
}
