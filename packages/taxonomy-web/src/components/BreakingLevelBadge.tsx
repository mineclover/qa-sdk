import type { BreakingLevel } from 'taxonomy-engine';

const STYLE: Record<BreakingLevel, string> = {
  major: 'bg-red-100 text-red-700 border border-red-300',
  minor: 'bg-amber-100 text-amber-700 border border-amber-300',
  patch: 'bg-gray-100 text-gray-600 border border-gray-300',
  none: 'bg-green-50 text-green-700 border border-green-200',
};

export function BreakingLevelBadge({ value }: { value: BreakingLevel }) {
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${STYLE[value]}`}
      title={`breakingLevel: ${value}`}
    >
      {value}
    </span>
  );
}
