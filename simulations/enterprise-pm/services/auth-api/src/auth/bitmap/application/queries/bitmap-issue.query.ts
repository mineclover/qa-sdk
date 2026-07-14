// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { BitmapIssueResult } from '../../domain/index.js';

/**
 * 사용자 권한 비트맵 발급 쿼리.
 *
 * Read-mostly 슬라이스 — 입력 userId 에 대해 User + Role + RoleAssignment
 * 데이터를 합성하여 서명된 VersionedBitmap 을 반환한다. 본 슬라이스 내부에는
 * write 영속이 없으며, 결과는 transient (서명 + TTL 만 의미).
 */
export abstract class BitmapIssueQuery {
  abstract issueForUser(userId: string): Promise<BitmapIssueResult | null>;
}
