/**
 * ActorContext의 identification_mode 자동 판별.
 *
 * 판별 규칙:
 * 1. 이미 지정되어 있으면 그대로
 * 2. platform=node + owner_type=workspace|tenant → "service"
 * 3. actor_id 없거나 "anonymous" 또는 빈 문자열 → "anonymous"
 * 4. user_id 존재 → "identified"
 * 5. actor_id만 있고 user_id 없음 → "pseudonymized"
 */

import type { IdentificationMode } from "../types/event-pattern.js";

export interface IdentifyActorInput {
  actor_id?: string;
  user_id?: string;
  identification_mode?: IdentificationMode;
  /** 전송 컨텍스트 (선택) */
  platform?: string;
  owner_type?: string;
}

export function identifyActorMode(input: IdentifyActorInput): IdentificationMode {
  // 이미 명시되어 있으면 사용
  if (input.identification_mode) return input.identification_mode;

  // 서비스 간 호출
  if (
    input.platform === "node" &&
    (input.owner_type === "workspace" || input.owner_type === "tenant")
  ) {
    return "service";
  }

  // actor_id 없거나 "anonymous"
  if (!input.actor_id || input.actor_id === "anonymous" || input.actor_id === "") {
    return "anonymous";
  }

  // user_id 있으면 identified
  if (input.user_id) return "identified";

  // actor_id만 있으면 pseudonymized
  return "pseudonymized";
}
