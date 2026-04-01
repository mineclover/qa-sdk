/**
 * permission-change-notifier.ts — 권한 변경의 단일 진입점.
 *
 * 권한 관련 데이터(role 배정, override)가 변경될 때마다 이 클래스를 통해
 * 버전 bump + 선택적 provider 세션 취소를 원자적으로 처리한다.
 *
 * 소프트 만료 (기본):
 *   버전 bump → 다음 요청에서 미들웨어가 401 반환 → 클라이언트가 재발급
 *
 * 하드 취소 (hardRevoke=true):
 *   버전 bump + provider.revokeUserSessions() → 즉시 모든 세션 종료
 *   보안 이슈, 긴급 권한 회수 시 사용.
 */

import { type PermissionVersionStore } from "./permission-version.js";
import { type AuthProvider } from "./auth-provider.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotifyOptions {
  /**
   * true이면 provider에서 모든 세션을 즉시 종료한다.
   * false(기본)이면 버전 bump만 — 다음 토큰 refresh 시 반영.
   */
  hardRevoke?: boolean;
}

export interface NotifyResult {
  userId: string;
  newVersion: number;
  hardRevoked: boolean;
}

// ── PermissionChangeNotifier ──────────────────────────────────────────────────

export class PermissionChangeNotifier {
  constructor(
    private readonly versionStore: PermissionVersionStore,
    private readonly provider?: AuthProvider,
  ) {}

  /**
   * 단일 유저의 권한 변경을 알린다.
   */
  async notify(userId: string, opts: NotifyOptions = {}): Promise<NotifyResult> {
    const newVersion = await this.versionStore.bumpVersion(userId);

    let hardRevoked = false;
    if (opts.hardRevoke && this.provider) {
      await this.provider.revokeUserSessions(userId);
      hardRevoked = true;
    }

    return { userId, newVersion, hardRevoked };
  }

  /**
   * 여러 유저의 권한 변경을 동시에 알린다.
   * 예: org role 정의가 바뀌어서 해당 org role을 가진 모든 유저에게 영향
   */
  async notifyBatch(
    userIds: readonly string[],
    opts: NotifyOptions = {},
  ): Promise<NotifyResult[]> {
    return Promise.all(userIds.map(id => this.notify(id, opts)));
  }
}
