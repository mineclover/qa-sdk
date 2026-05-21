import { useEffect, useState } from "react";
import type { Feedback, FeedbackTag, FeedbackStatus } from "../types/feedback";
import { FEEDBACK_TAGS, FEEDBACK_STATUSES } from "../types/feedback";
import { fetchFeedbacks } from "../data/feedbacksApi";
import { filterFeedback } from "../lib/filterFeedback";
import { FeedbackList } from "../components/FeedbackList";

export function FeedbacksPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [statuses, setStatuses] = useState<FeedbackStatus[]>([]);

  useEffect(() => { fetchFeedbacks().then(setItems); }, []);

  const filtered = filterFeedback(items, { tags: tags.length ? tags : undefined, statuses: statuses.length ? statuses : undefined });

  return (
    <div className="p-4">
      <h2 className="font-bold text-lg mb-3">전체 피드백 ({filtered.length}/{items.length})</h2>
      <div className="flex gap-4 mb-4 text-sm">
        <div>
          <strong>tag:</strong>
          {FEEDBACK_TAGS.map((t) => (
            <label key={t} className="ml-2">
              <input
                type="checkbox"
                checked={tags.includes(t)}
                onChange={(e) =>
                  setTags((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
                }
              />{" "}{t}
            </label>
          ))}
        </div>
        <div>
          <strong>status:</strong>
          {FEEDBACK_STATUSES.map((s) => (
            <label key={s} className="ml-2">
              <input
                type="checkbox"
                checked={statuses.includes(s)}
                onChange={(e) =>
                  setStatuses((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                }
              />{" "}{s}
            </label>
          ))}
        </div>
      </div>
      <FeedbackList items={filtered} />
    </div>
  );
}
