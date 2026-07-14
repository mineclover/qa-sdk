// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

/**
 * 시나리오 공용 HTTP 헬퍼.
 *
 * gateway 경유 fetch — in-process 모드에서는 globalThis.__simGatewayFetch 주입,
 * http 모드에서는 native fetch 위임.
 */

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
}

/** gateway에 로그인 → JWT 응답 반환. */
export async function loginViaGateway(
  gatewayUrl: string,
  creds: { email: string; password: string },
): Promise<LoginResponse> {
  const res = await fetch(`${gatewayUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`login failed: status=${res.status} body=${body}`);
  }
  return (await res.json()) as LoginResponse;
}

/** Bearer 헤더 객체. */
export function authHeaders(
  token: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...extra };
}

/** 응답에서 x-trace-id 추출 (없으면 빈 문자열). */
export function extractTraceId(res: Response): string {
  return res.headers.get('x-trace-id') ?? '';
}
