import type { Lifecycle } from 'taxonomy-engine';

const STYLE: Record<Lifecycle, string> = {
  draft: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  deprecated: 'bg-gray-200 text-gray-600',
  archived: 'bg-gray-700 text-white',
  tbd: 'bg-red-50 text-red-700 border border-dashed border-red-400',
};

export const LIFECYCLE_VALUES: Lifecycle[] = [
  'draft',
  'review',
  'approved',
  'deprecated',
  'archived',
  'tbd',
];

export function LifecycleBadge({ value, title }: { value?: Lifecycle; title?: string }) {
  if (!value) {
    return (
      <span
        className="text-[10px] px-1 py-0.5 rounded bg-gray-50 text-gray-400 font-mono"
        title="lifecycle 미지정"
      >
        (none)
      </span>
    );
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${STYLE[value]}`} title={title}>
      {value}
    </span>
  );
}
