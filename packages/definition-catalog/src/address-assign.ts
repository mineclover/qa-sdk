/**
 * 유일 주소 할당.
 *
 * 같은 scope×aspect×depth 내에서 순번(seq)을 부여하여
 * 각 문서에 유일한 v2 주소를 할당한다.
 */
import type { DefinitionEntry, DefScope, DefAspect, DefDepth } from "./types.js";
import { encodeUniqueDocument, serializeUniqueDocumentAddress } from "./observe.js";

/** 주소 할당 결과 */
export interface AddressAssignment {
  readonly docId: string;
  readonly label: string;
  readonly address: number;
  readonly serialized: string;
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly depth: DefDepth;
  readonly seq: number;
}

/**
 * 문서 목록에 유일 주소를 할당한다.
 *
 * 같은 scope×aspect×depth 그룹 내에서 id 기준 정렬 후 순번 부여.
 * 순번은 1-based (WeightedIndex 규칙).
 */
export function assignUniqueAddresses(entries: readonly DefinitionEntry[]): readonly AddressAssignment[] {
  // scope×aspect×depth별 그룹핑
  const groups = new Map<string, DefinitionEntry[]>();
  for (const entry of entries) {
    const key = `${entry.scope}/${entry.aspect}/${entry.depth}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const assignments: AddressAssignment[] = [];

  for (const [, group] of groups) {
    // id 기준 정렬 (결정론적 순서)
    group.sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 0; i < group.length; i++) {
      const entry = group[i];
      if (!entry) continue;
      const seq = i + 1;  // 1-based
      const address = encodeUniqueDocument({
        scope: entry.scope,
        aspect: entry.aspect,
        depth: entry.depth,
        seq,
      });

      assignments.push({
        docId: entry.id,
        label: entry.id,
        address,
        serialized: serializeUniqueDocumentAddress(address),
        scope: entry.scope,
        aspect: entry.aspect,
        depth: entry.depth,
        seq,
      });
    }
  }

  return assignments;
}

/**
 * 주소 할당 결과에서 id → address 매핑을 생성한다.
 */
export function buildIdToAddressMap(assignments: readonly AddressAssignment[]): ReadonlyMap<string, number> {
  return new Map(assignments.map(a => [a.docId, a.address]));
}

/**
 * 주소 할당 결과에서 address → id 매핑을 생성한다.
 */
export function buildAddressToIdMap(assignments: readonly AddressAssignment[]): ReadonlyMap<number, string> {
  return new Map(assignments.map(a => [a.address, a.docId]));
}
