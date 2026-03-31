/**
 * 하위 호환 레이어 — deprecated API
 *
 * 새 코드에서는 이 파일을 import하지 않는다.
 * 기존 소비자가 마이그레이션할 때까지만 유지.
 */

import type { DefAspect, DefScope } from "./types.js";
import { ASPECT_TO_SCOPES } from "./taxonomy.js";

/**
 * @deprecated ASPECT_TO_SCOPES로 대체. 1:1 역참조는 N:M에서 보장되지 않음.
 * 하위 호환을 위해 유지하되, 첫 번째 scope만 반환한다.
 */
export const ASPECT_TO_SCOPE: Record<DefAspect, DefScope> = Object.fromEntries(
  Object.entries(ASPECT_TO_SCOPES).map(
    ([aspect, scopes]) => [aspect, scopes[0]],
  ),
) as Record<DefAspect, DefScope>;
