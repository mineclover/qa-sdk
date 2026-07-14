// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Decode Adapter — 인코딩된 address_context → 디코딩된 축:entry flat map.
 *
 * ingest Phase 2.5에서 TransitionEngine에 전달하기 전에 호출.
 * { "tracking": "tracking:v2:42" } → { "trackAction": "submit", "page": "checkout", ... }
 *
 * @qa-sdk/core의 parseSerializedAddress + decodePrefix 사용.
 * decode 실패 시 해당 prefix skip (에러 격리).
 */

import type { Catalog } from '@qa-sdk/core';
import { parseSerializedAddress, decodePrefixAsResult } from '@qa-sdk/core';

/**
 * 인코딩된 address_context를 디코딩하여 축 이름→entry 값 flat map으로 변환한다.
 *
 * 입력: `{ "tracking": "tracking:v2:42", "flow_point": "flow_point:v1:15" }`
 * 출력: `{ "trackAction": "submit", "page": "checkout", "flow_name": "checkout", "flow_step": "entry", ... }`
 *
 * 같은 축 이름이 여러 prefix에서 나오면 나중 prefix가 덮어쓴다.
 * prefix_ref 차원은 kind로 명시적 판별하여 건너뛴다 (axis entry만 포함).
 */
export function decodeAddressContext(
  catalog: Catalog,
  encoded: Readonly<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [_prefixKey, serialized] of Object.entries(encoded)) {
    try {
      const parsed = parseSerializedAddress(serialized);
      const decoded = decodePrefixAsResult(catalog, parsed.prefix, parsed.version, parsed.address);

      for (const [label, dim] of Object.entries(decoded.dims)) {
        // axis 차원만 포함 — prefix_ref/table_ref는 건너뜀
        if (dim.kind !== 'axis') continue;

        result[label] = String(dim.value);
        // axisId가 label과 다르면 axisId로도 매핑 (TransitionSpec 호환)
        const prefixDef = catalog.prefixes?.[parsed.prefix];
        const dimDef = prefixDef?.dims[label];
        if (dimDef?.kind === 'axis' && dimDef.axisId !== label) {
          result[dimDef.axisId] = String(dim.value);
        }
      }
    } catch {
      // decode 실패 시 해당 prefix skip (에러 격리)
      continue;
    }
  }

  return result;
}
