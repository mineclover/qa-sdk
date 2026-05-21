import type { Feedback } from "../types/feedback";
import { FeedbackList } from "./FeedbackList";

export function FeedbackHistoryPanel({
  selectedRef,
  feedbacks,
}: {
  selectedRef: string;
  feedbacks: Feedback[];
}) {
  const all = feedbacks.filter((f) => f.ref === selectedRef);
  const open = all.filter((f) => f.status === "open");
  const closed = all.filter((f) => f.status !== "open");

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-bold text-blue-700 mb-1">Open ({open.length})</h4>
        <FeedbackList items={open} />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-600 mb-1">Closed ({closed.length})</h4>
        <FeedbackList items={closed} />
      </div>
    </div>
  );
}
