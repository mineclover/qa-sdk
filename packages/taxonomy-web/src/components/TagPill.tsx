import type { FeedbackTag } from '../types/feedback';

const TAG_STYLES: Record<FeedbackTag, string> = {
  bug: 'bg-red-100 text-red-800',
  improvement: 'bg-blue-100 text-blue-800',
  question: 'bg-amber-100 text-amber-800',
  approval: 'bg-green-100 text-green-800',
  concern: 'bg-purple-100 text-purple-800',
};

export function TagPill({ tag }: { tag: FeedbackTag }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded ${TAG_STYLES[tag]}`}>{tag}</span>
  );
}
