/**
 * auth-provider.ts — OAuth provider 추상화.
 *
 * 인증(토큰 취소, 세션 종료)만 담당한다.
 * role/group 배정은 provider에 위임하지 않는다 — Permission DB가 SSOT.
 *
 * 구현:
 *   ZitadelProvider  — Zitadel v2 Management API
 *   KeycloakProvider — Keycloak Admin REST API
 *
 * 추가 provider는 AuthProvider 인터페이스를 구현하면 된다.
 */

// ── Interface ─────────────────────────────────────────────────────────────────

export interface AuthProvider {
  readonly id: string;

  /**
   * 특정 유저의 모든 활성 세션을 종료한다.
   * 재로그인을 강제한다.
   * hardRevoke 시나리오에서만 사용할 것 (provider API 부하).
   */
  revokeUserSessions(userId: string): Promise<void>;

  /**
   * 단일 refresh token을 폐기한다 (지원하는 provider만).
   * access token TTL이 만료되면 자연 소멸.
   */
  revokeRefreshToken?(refreshToken: string): Promise<void>;
}

// ── Zitadel ──────────────────────────────────────────────────────────────────

export interface ZitadelProviderOptions {
  /** Zitadel 인스턴스 URL. 예: "https://your-instance.zitadel.cloud" */
  issuerUrl: string;
  /** Management API 호출용 M2M access token. */
  serviceToken: string;
  /** 조직 ID (선택). 지정 시 해당 조직 내 세션만 취소. */
  organizationId?: string;
}

export class ZitadelProvider implements AuthProvider {
  readonly id = "zitadel";

  constructor(private readonly opts: ZitadelProviderOptions) {}

  async revokeUserSessions(userId: string): Promise<void> {
    // Zitadel v2: 유저의 모든 세션 목록 조회 후 삭제
    const baseUrl = this.opts.issuerUrl.replace(/\/$/, "");
    const headers = {
      "Authorization": `Bearer ${this.opts.serviceToken}`,
      "Content-Type": "application/json",
    };

    // 1. 세션 목록 조회
    const listRes = await fetch(`${baseUrl}/v2/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        queries: [{ userIdQuery: { userId } }],
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!listRes.ok) {
      throw new Error(`Zitadel list sessions failed: ${listRes.status}`);
    }

    const { sessions = [] } = await listRes.json() as { sessions?: { id: string }[] };

    // 2. 각 세션 삭제
    await Promise.all(
      sessions.map(session =>
        fetch(`${baseUrl}/v2/sessions/${session.id}`, {
          method: "DELETE",
          headers,
          signal: AbortSignal.timeout(5_000),
        })
      )
    );
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const baseUrl = this.opts.issuerUrl.replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/oauth/v2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      throw new Error(`Zitadel revoke token failed: ${res.status}`);
    }
  }
}

// ── Keycloak ──────────────────────────────────────────────────────────────────

export interface KeycloakProviderOptions {
  /** Keycloak base URL. 예: "https://auth.example.com" */
  baseUrl: string;
  /** realm 이름. */
  realm: string;
  /** Admin REST API 호출용 access token. */
  adminToken: string;
}

export class KeycloakProvider implements AuthProvider {
  readonly id = "keycloak";

  constructor(private readonly opts: KeycloakProviderOptions) {}

  async revokeUserSessions(userId: string): Promise<void> {
    const { baseUrl, realm, adminToken } = this.opts;
    const url = `${baseUrl.replace(/\/$/, "")}/admin/realms/${realm}/users/${userId}/logout`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}` },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok && res.status !== 204) {
      throw new Error(`Keycloak revoke sessions failed: ${res.status}`);
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const { baseUrl, realm } = this.opts;
    const url = `${baseUrl.replace(/\/$/, "")}/realms/${realm}/protocol/openid-connect/revoke`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      throw new Error(`Keycloak revoke token failed: ${res.status}`);
    }
  }
}

// ── NoopProvider (테스트 / provider 없는 환경) ────────────────────────────────

export class NoopAuthProvider implements AuthProvider {
  readonly id = "noop";
  async revokeUserSessions(_userId: string): Promise<void> { /* no-op */ }
  async revokeRefreshToken(_token: string): Promise<void> { /* no-op */ }
}
