/**
 * 문서 좌표 주소 계산 — legacy fallback.
 *
 * explicit v2 address가 없는 문서에 한해 scope × aspect × depth 기반
 * `def_document:v1:<N>`를 계산한다.
 * 유효하지 않은 값이면 null 반환 (주소 계산 실패가 저장을 차단하지 않음).
 */

import {
  encodeDocument,
  serializeDocumentAddress,
  type DefScope,
  type DefAspect,
  type DefDepth,
  DEF_SCOPE,
  DEF_ASPECT,
  DEF_DEPTH,
} from "definition-catalog";

export function computeDocumentAddress(
  scope: string,
  aspect: string,
  depth: string,
): string | null {
  if (
    !DEF_SCOPE.entries.includes(scope as DefScope) ||
    !DEF_ASPECT.entries.includes(aspect as DefAspect) ||
    !DEF_DEPTH.entries.includes(depth as DefDepth)
  ) {
    return null;
  }

  try {
    const address = encodeDocument({
      scope: scope as DefScope,
      aspect: aspect as DefAspect,
      depth: depth as DefDepth,
    });
    return serializeDocumentAddress(address);
  } catch {
    return null;
  }
}
