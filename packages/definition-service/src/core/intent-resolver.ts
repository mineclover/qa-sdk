// @def.doc definition-service

/**
 * 의도 해석 — 슬라이스 매칭 + 의도 체인 조립
 *
 * HTTP/DB 무관한 순수 로직.
 */

import { sliceContains } from "definition-catalog";
import type { SliceIntentRecord } from "./types.js";

/**
 * dims 쿼리 파라미터를 파싱한다.
 * "page:checkout,locale:ko" → { page: "checkout", locale: "ko" }
 */
export function parseDimsParam(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;

  for (const pair of raw.split(",")) {
    const sep = pair.indexOf(":");
    if (sep > 0) {
      result[pair.slice(0, sep).trim()] = pair.slice(sep + 1).trim();
    }
  }
  return result;
}

/**
 * 주어진 주소(차원 값 전체)에 매칭되는 의도를 찾는다.
 * 넓은 슬라이스부터 좁은 슬라이스 순으로 반환 (상속 체인).
 */
export function resolveMatchingIntents(
  address: Record<string, string>,
  intents: readonly SliceIntentRecord[],
): SliceIntentRecord[] {
  return intents
    .filter((intent) => {
      const slice = JSON.parse(intent.sliceJson) as Record<string, string>;
      return sliceContains(slice, address);
    })
    .toSorted((a, b) => a.sliceDepth - b.sliceDepth);
}
