import type { TaxonomyIR, EntryIR } from "../schema/ir.js";

export type SliceRange = { from?: number; to?: number; ids?: string[] };

/**
 * slice — axis에서 entries 부분집합 추출.
 * - ids 제공 시 id로 필터
 * - from/to (inclusive) 제공 시 address 범위로 필터
 * - 둘 다 없으면 전체
 */
export function slice(
  ir: TaxonomyIR,
  axisName: string,
  range?: SliceRange,
): EntryIR[] {
  const axis = ir.axes.get(axisName);
  if (!axis) return [];

  let entries = axis.entries;

  if (range?.ids) {
    const idSet = new Set(range.ids);
    entries = entries.filter((e) => idSet.has(e.id));
  }

  if (range?.from !== undefined) {
    entries = entries.filter((e) => e.address >= range.from!);
  }

  if (range?.to !== undefined) {
    entries = entries.filter((e) => e.address <= range.to!);
  }

  return entries;
}
