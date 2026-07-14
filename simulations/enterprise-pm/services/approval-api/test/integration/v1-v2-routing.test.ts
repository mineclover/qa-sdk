// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import { describe, it, expect } from 'vitest';

/**
 * 통합 테스트 — gateway → v1/v2 라우팅 후 stamp 확인.
 *
 * spec 02-canary-topology.md §3.4 — `x-canary-override: v1|v2` (내부 IP 한정)로
 * 강제 라우팅. 응답 `x-service-version`이 의도한 버전과 일치하는지 단언.
 *
 * 단계 8에서는 scaffold만 (`.skip`). 단계 9의 gateway 라우팅 + Plan B 단계 6의
 * x-canary-override middleware 활성화 후 본 테스트의 `.skip`을 제거한다.
 *
 * 의존:
 * - sim-gateway 컨테이너 부팅 (8888)
 * - sim-approval-api-v1 + sim-approval-api-v2 둘 다 healthy
 * - .env.sim에 APPROVAL_V1_TAG / APPROVAL_V2_TAG 설정
 *
 * follow-up #19 (auth-api idempotencyKey 누락) 미해결 시 sim-up이 fail —
 * 그 경우 본 테스트 `.skip`은 유지된다.
 */
describe.skip('v1/v2 routing integration (pending stage 9)', () => {
  const GATEWAY_URL = process.env.SIM_GATEWAY_URL ?? 'http://sim-gateway:8888';

  it('gateway routes to v1 when x-canary-override=v1', async () => {
    const resp = await fetch(`${GATEWAY_URL}/bff/budget-requests/b-1`, {
      headers: { 'x-canary-override': 'v1' },
    });
    expect(resp.headers.get('x-service-version')).toMatch(/^v3/);
  });

  it('gateway routes to v2 when x-canary-override=v2', async () => {
    const resp = await fetch(`${GATEWAY_URL}/bff/budget-requests/b-1`, {
      headers: { 'x-canary-override': 'v2' },
    });
    expect(resp.headers.get('x-service-version')).toMatch(/^v4/);
  });

  it('gateway 응답 x-service-version은 grammar #3 형식이다', async () => {
    const resp = await fetch(`${GATEWAY_URL}/bff/budget-requests/b-1`);
    const v = resp.headers.get('x-service-version');
    expect(v).toMatch(/^v\d+(-stable|-candidate)?$/);
  });
});

/**
 * 본 placeholder는 lint/test runner가 빈 파일 경고를 내지 않도록 유지.
 * 단계 9에서 .skip 제거.
 */
describe('v1-v2 routing scaffold marker', () => {
  it('scaffold file is loaded', () => {
    expect(true).toBe(true);
  });
});
