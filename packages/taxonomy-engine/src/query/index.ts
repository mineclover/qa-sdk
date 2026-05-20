import { parseRef } from "../ref/parser.js";
import { resolveRef } from "../ref/resolver.js";
import type { RefResult } from "../ref/types.js";
import type { TaxonomyRegistry } from "../registry/index.js";
import type { TaxonomyIR, EntryIR, Coordinate } from "../schema/ir.js";

/**
 * show — parseRef + resolveRef 통합 wrapper. 3-tier ref 문자열을 받아 단일 단위 조회.
 * 잘못된 ref 형식이면 throw (parseRef 호출이 throw); 등록되지 않은 taxonomy/entry는 fail-open(undefined).
 */
export function show(
  refStr: string,
  registry: TaxonomyRegistry,
): RefResult | undefined {
  const ref = parseRef(refStr);
  return resolveRef(ref, registry);
}

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

/**
 * walkRelation — relation의 rules를 그래프로 보고, startId에서 도달 가능한 entry id를 순회.
 * relation kind 무관 (rules 안의 모든 field 값을 다음 노드로 취급).
 * 순환 방지 (visited set).
 */
export function* walkRelation(
  ir: TaxonomyIR,
  relName: string,
  startId: string,
): IterableIterator<string> {
  const rel = ir.relations.get(relName);
  if (!rel) return;

  const visited = new Set<string>();
  const stack: string[] = [startId];

  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;

    visited.add(cur);
    yield cur;

    // cur에서 출발하는 rule 찾기 — rule의 value 중 하나가 cur이면 같은 rule의 다른 value를 next로
    for (const rule of rel.rules) {
      const values = Object.values(rule);
      if (!values.includes(cur)) continue;

      for (const v of values) {
        if (v !== cur && !visited.has(v)) {
          stack.push(v);
        }
      }
    }
  }
}

/**
 * walkByCoordinate — Coordinate(부분 좌표)에서 출발해 relation 화살표를 따라
 * 도달 가능한 모든 Coordinate를 yield. cross-axis 흐름 추적용.
 *
 * 규칙:
 * - relation rules 중 startCoord와 호환되는 rule을 찾음 (startCoord에 명시된 키 ⊆ rule 키, 해당 키의 값 일치)
 * - 일치하는 rule의 모든 키-값을 새 coordinate로 전환
 * - 새 coordinate가 visited 아니면 yield + stack push
 * - 순환 방지: 좌표 stable string key로 visited Set 보관
 */
export function* walkByCoordinate(
  ir: TaxonomyIR,
  relName: string,
  startCoord: Coordinate,
): IterableIterator<Coordinate> {
  const rel = ir.relations.get(relName);
  if (!rel) return;

  const visited = new Set<string>();
  const stack: Coordinate[] = [startCoord];

  while (stack.length > 0) {
    const cur = stack.pop()!;
    const key = coordKey(cur);
    if (visited.has(key)) continue;

    visited.add(key);
    yield cur;

    for (const rule of rel.rules) {
      if (!isCompatible(cur, rule)) continue;
      const next: Coordinate = {};
      for (const [k, v] of Object.entries(rule)) {
        next[k] = v;
      }
      const nextKey = coordKey(next);
      if (!visited.has(nextKey)) {
        stack.push(next);
      }
    }
  }
}

function isCompatible(coord: Coordinate, rule: Record<string, string>): boolean {
  // coord에 명시된 모든 키가 rule에 같은 값으로 있어야
  for (const [k, v] of Object.entries(coord)) {
    if (rule[k] !== v) return false;
  }
  return Object.keys(coord).length > 0;
}

function coordKey(coord: Coordinate): string {
  const keys = Object.keys(coord).sort();
  return keys.map((k) => `${k}=${coord[k]}`).join(",");
}
