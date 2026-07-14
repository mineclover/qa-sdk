import type { Feedback } from '../types/feedback';
import { StatusBadge } from './StatusBadge';
import { TagPill } from './TagPill';

export function FeedbackList({
  items,
  onSelect,
}: {
  items: Feedback[];
  onSelect?: (f: Feedback) => void;
}) {
  if (items.length === 0) {
    return <div className="text-sm text-gray-500 py-4 text-center">피드백 없음</div>;
  }
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li
          key={f.id}
          className="border rounded p-2 hover:bg-gray-50 cursor-pointer"
          onClick={() => onSelect?.(f)}
        >
          <div className="flex items-center gap-2 text-xs">
            <TagPill tag={f.tag} />
            <StatusBadge status={f.status} />
            <span className="text-gray-500 font-mono">{f.ref}</span>
            <span className="text-gray-400 ml-auto">{f.createdAt.slice(0, 10)}</span>
          </div>
          <div className="mt-1 text-sm">{f.text}</div>
        </li>
      ))}
    </ul>
  );
}
