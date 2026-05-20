import { parseRef } from "../ref/parser.js";
import { resolveRef } from "../ref/resolver.js";
import type { RefResult } from "../ref/types.js";
import type { TaxonomyRegistry } from "../registry/index.js";

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
