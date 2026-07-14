import type { FeedbackStatus } from '../types/feedback';

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-200 text-gray-700',
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
