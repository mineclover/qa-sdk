import { parseServicePrefix, parseVersionTag } from "sim-identifier-grammar";
import type { CatalogPrefixDefinition, ServiceState } from "./types.js";

/**
 * spec 02 §5: catalog에서 (prefix, state) → version 매핑을 정확히 1개 돌려준다.
 * 0개 또는 2개 이상이면 invariant 위반으로 throw.
 */
export function getServiceVersionTag(
  catalog: CatalogPrefixDefinition,
  state: ServiceState,
): string {
  parseServicePrefix(catalog.prefix); // raw 문자열 차단
  const matched = catalog.refEntries.filter((e) => e.state === state);
  if (matched.length === 0) {
    throw new Error(
      `getServiceVersionTag: prefix=${catalog.prefix} state=${state} — 0개 매칭 (exactly one expected)`,
    );
  }
  if (matched.length > 1) {
    throw new Error(
      `getServiceVersionTag: prefix=${catalog.prefix} state=${state} — ${matched.length}개 매칭 (0개 또는 2개 이상은 invariant 위반)`,
    );
  }
  parseVersionTag(matched[0].version); // 반환 전 grammar 검증
  return matched[0].version;
}
