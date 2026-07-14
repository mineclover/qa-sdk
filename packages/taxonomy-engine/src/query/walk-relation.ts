import type { TaxonomyIR } from '../schema/ir.js';

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
