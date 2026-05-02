// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { SubscriptionUserQueryPort } from "../../application/ports/user-query.port.js";

/** 테스트 주입용 fetch 추상 (전역 fetch 와 호환). */
export type FetchLike = (
  input: string | URL,
  init?: { signal?: AbortSignal },
) => Promise<{ status: number }>;

export interface HttpSubscriptionUserQueryOptions {
  /** auth-api base URL — 예: "http://auth-api.local:3000" (trailing slash 없음). */
  readonly authApiBaseUrl: string;
  /** ms 단위 timeout. 기본 5000. */
  readonly timeoutMs?: number;
  /** 테스트 주입 — 미지정 시 globalThis.fetch. */
  readonly fetchImpl?: FetchLike;
}

/**
 * Cross-process HTTP 어댑터.
 *
 * - auth-api 의 `GET /users/:id` 를 호출 — 200 → exists, 404 → not exists.
 * - `AbortSignal.timeout` 으로 외부 fetch 보호 (CLAUDE.md "네트워크 호출").
 * - timeout / 5xx / 네트워크 에러 → fail-open (true) — gate 부재가 알림
 *   파이프라인을 차단하지 않도록 (CLAUDE.md "Fail-open").
 *
 * Note: 운영 환경에서 cross-service 마이크로서비스 경계를 더 잘 표현하는 형태.
 */
export class HttpSubscriptionUserQuery extends SubscriptionUserQueryPort {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(opts: HttpSubscriptionUserQueryOptions) {
    super();
    this.baseUrl = opts.authApiBaseUrl.replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 5_000;
    this.fetchImpl = opts.fetchImpl ?? ((globalThis as { fetch?: FetchLike }).fetch as FetchLike);
    if (!this.fetchImpl) {
      throw new Error(
        "HttpSubscriptionUserQuery: global fetch unavailable — pass fetchImpl explicitly",
      );
    }
  }

  async userExists(userId: string): Promise<boolean> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(userId)}`;
    try {
      const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (res.status === 200) return true;
      if (res.status === 404) return false;
      // 5xx 등 비명시 응답 → fail-open
      return true;
    } catch {
      return true;
    }
  }
}
