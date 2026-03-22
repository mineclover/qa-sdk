/**
 * Decode Adapter — 인코딩된 address_context → 디코딩된 축:entry flat map.
 *
 * ingest Phase 2.5에서 TransitionEngine에 전달하기 전에 호출.
 * { "tracking": "tracking:v2:42" } → { "trackAction": "submit", "page": "checkout", ... }
 *
 * @qa-sdk/core의 parseSerializedAddress + decodePrefix 사용.
 * decode 실패 시 해당 prefix skip (에러 격리).
 */

import type { Catalog } from "@qa-sdk/core";
import { parseSerializedAddress, decodePrefix } from "@qa-sdk/core";

/**
 * 인코딩된 address_context를 디코딩하여 축 이름→entry 값 flat map으로 변환한다.
 *
 * 입력: `{ "tracking": "tracking:v2:42", "flow_point": "flow_point:v1:15" }`
 * 출력: `{ "trackAction": "submit", "page": "checkout", "flow_name": "checkout", "flow_step": "entry", ... }`
 *
 * 같은 축 이름이 여러 prefix에서 나오면 나중 prefix가 덮어쓴다.
 * prefix_ref 차원의 value는 정수 주소이므로 건너뛴다 (string entry만 포함).
 */
export function decodeAddressContext(
  catalog: Catalog,
  encoded: Readonly<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [_prefixKey, serialized] of Object.entries(encoded)) {
    try {
      const parsed = parseSerializedAddress(serialized);
      const decoded = decodePrefix(catalog, parsed.prefix, parsed.version, parsed.address);

      // prefix dims에서 label → axisId 매핑 추출
      const prefixDef = (catalog as any).prefixes?.[parsed.prefix];
      const dims = prefixDef?.dims as Record<string, { kind: string; axisId?: string }> | undefined;

      for (const [label, dim] of Object.entries(decoded)) {
        // prefix_ref의 value는 정수 주소 — string entry만 포함
        if (typeof dim.value === "string") {
          result[label] = dim.value;
          // axisId가 label과 다르면 axisId로도 매핑 (TransitionSpec 호환)
          const axisId = dims?.[label]?.axisId;
          if (axisId && axisId !== label) {
            result[axisId] = dim.value;
          }
        }
      }
    } catch {
      // decode 실패 시 해당 prefix skip (에러 격리)
      continue;
    }
  }

  return result;
}
