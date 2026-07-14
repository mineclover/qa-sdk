import type { TaxonomyIR, Coordinate } from '../schema/ir.js';

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
  return keys.map((k) => `${k}=${coord[k]}`).join(',');
}
