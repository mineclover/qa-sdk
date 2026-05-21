import type { Feedback, FeedbackTag, FeedbackStatus } from "../types/feedback";

export type FeedbackFilter = {
  ref?: string;
  tags?: FeedbackTag[];
  statuses?: FeedbackStatus[];
  taxonomy?: string;   // ref가 이 taxonomy로 시작
};

export function filterFeedback(items: Feedback[], filter: FeedbackFilter): Feedback[] {
  return items.filter((f) => {
    if (filter.ref && f.ref !== filter.ref) return false;
    if (filter.tags && filter.tags.length > 0 && !filter.tags.includes(f.tag)) return false;
    if (filter.statuses && filter.statuses.length > 0 && !filter.statuses.includes(f.status)) return false;
    if (filter.taxonomy && !f.ref.startsWith(filter.taxonomy)) return false;
    return true;
  });
}
