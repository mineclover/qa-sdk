#!/usr/bin/env pnpm exec tsx
/**
 * 게이트웨이 통합 테스트
 *
 * K3s에 배포된 서비스들을 gateway를 통해 접근 테스트.
 * gateway는 K3s 내부에서 실행, port-forward로 로컬 접근.
 *
 * 실행: pnpm exec tsx packages/infra-engine/scripts/test-gateway.ts
 */

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://127.0.0.1:28787';

interface TestResult {
  name: string;
  ok: boolean;
  status?: number;
  preview?: string;
  error?: string;
}

const results: TestResult[] = [];

async function test(
  name: string,
  url: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    expectedStatus?: number;
  } = {},
): Promise<boolean> {
  const { method = 'GET', body, headers = {}, expectedStatus = 200 } = options;
  try {
    const res = await fetch(url, {
      method,
      body,
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: AbortSignal.timeout(5000),
    });
    const ok = res.status === expectedStatus;
    const text = await res.text().catch(() => '');
    const preview = text.slice(0, 120);
    const result: TestResult = { name, ok, status: res.status, preview };
    results.push(result);
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}: ${res.status} ${preview}`);
    return ok;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, error });
    console.log(`  FAIL ${name}: ${error}`);
    return false;
  }
}

const GATEWAY_JWT_URL = process.env.GATEWAY_JWT_URL ?? 'http://127.0.0.1:28788';

async function main() {
  console.log('\n=== 게이트웨이 통합 테스트 ===');
  console.log(`대상: ${GATEWAY_URL}`);
  console.log(`JWT 대상: ${GATEWAY_JWT_URL}\n`);

  // 1. Gateway 헬스
  console.log('[1] Gateway 헬스체크');
  await test('GET /health', `${GATEWAY_URL}/health`);

  // 2. Ingest Server 라우팅 (K3s 내부 서비스 → gateway 프록시)
  console.log('\n[2] Ingest Server 라우팅');
  await test('GET /v1/sessions', `${GATEWAY_URL}/v1/sessions`);

  // 3. POST /v1/ingest (프록시 + body 전달)
  console.log('\n[3] POST /v1/ingest');
  const txId = `gw-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ingestBody = JSON.stringify({
    transmission_id: txId,
    sent_at: new Date().toISOString(),
    owner: { owner_type: 'agent', owner_id: 'gateway-test' },
    source: {
      service_name: 'gateway-test',
      sdk_name: 'test',
      sdk_version: '1.0',
    },
    runtime: { platform: 'node' },
    build: { env: 'dev' },
    records: [
      {
        log_id: `gw-${Date.now()}`,
        timestamp: new Date().toISOString(),
        record_kind: 'log',
        trace_id: 'gw-trace',
        span_id: 'gw-span',
        event_key: 'deploy_event',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { test: 'gateway-integration' },
      },
    ],
  });
  await test('POST /v1/ingest', `${GATEWAY_URL}/v1/ingest`, {
    method: 'POST',
    body: ingestBody,
    expectedStatus: 202,
  });

  // 4. Registry Service 라우팅
  console.log('\n[4] Registry Service 라우팅');
  // registry는 localhost:3300 — gateway가 K3s 내부에서 접근하므로 실패 예상
  // (registry는 K3s에 배포되어 있지 않으므로 502 예상)
  await test(
    'GET /api/services?catalog=demo (registry — K3s 외부)',
    `${GATEWAY_URL}/api/services?catalog=demo`,
    { expectedStatus: 502 },
  );

  // 5. 인증 테스트 — bypass 모드 확인
  console.log('\n[5] 인증 테스트');
  await test('무인증 요청 (bypass 모드)', `${GATEWAY_URL}/health`);

  // 6. 인증 테스트 — api-key 모드 시뮬레이션 (현재 bypass이므로 정상 통과)
  await test('Authorization 헤더 포함', `${GATEWAY_URL}/health`, {
    headers: { Authorization: 'Bearer test-key-12345' },
  });

  // 7. 미등록 경로 → 404
  console.log('\n[6] 미등록 경로');
  await test('GET /unknown → 404', `${GATEWAY_URL}/unknown`, {
    expectedStatus: 404,
  });

  // 8. CORS 헤더 확인
  console.log('\n[7] CORS 헤더');
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
      signal: AbortSignal.timeout(5000),
    });
    const acaoHeader = res.headers.get('access-control-allow-origin');
    const ok = acaoHeader === '*';
    results.push({
      name: 'CORS Access-Control-Allow-Origin: *',
      ok,
      preview: `ACAO: ${acaoHeader}`,
    });
    console.log(`  ${ok ? 'PASS' : 'FAIL'} CORS Access-Control-Allow-Origin: ${acaoHeader}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name: 'CORS', ok: false, error });
    console.log(`  FAIL CORS: ${error}`);
  }

  // === JWT Auth 테스트 ===
  console.log('\n[8] JWT 인증 테스트');

  // JWT 게이트웨이 접근 가능 여부 확인
  let jwtGatewayAvailable = false;
  try {
    const res = await fetch(`${GATEWAY_JWT_URL}/health`, { signal: AbortSignal.timeout(2000) });
    jwtGatewayAvailable = res.ok;
  } catch {
    /* JWT 게이트웨이 미실행 */
  }

  if (jwtGatewayAvailable) {
    const { createTestJwt, TEST_TOKENS } = await import('../src/auth/test-jwt.js');

    // 8a. 유효한 JWT (admin)
    const adminToken = TEST_TOKENS.admin();
    await test('JWT admin 토큰 → 200', `${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // 8b. perms 없는 JWT → 403
    const noPermsToken = TEST_TOKENS.noPerms();
    await test('JWT perms 없음 → 403', `${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${noPermsToken}` },
      expectedStatus: 403,
    });

    // 8c. JWT 없이 접근 → 401
    await test('JWT 미포함 → 401', `${GATEWAY_JWT_URL}/api/services`, {
      expectedStatus: 401,
    });

    // 8d. 잘못된 JWT → 401
    await test('잘못된 JWT → 401', `${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: 'Bearer not.a.valid-jwt' },
      expectedStatus: 401,
    });

    // 8e. reader 토큰 (perms 있음) → 200
    const readerToken = TEST_TOKENS.reader();
    await test('JWT reader 토큰 → 200', `${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${readerToken}` },
    });
  } else {
    console.log('  SKIP JWT 게이트웨이 미실행 (GATEWAY_JWT_URL 또는 AUTH_MODE=jwt 인스턴스 필요)');
  }

  // 결과 요약
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== 결과: ${passed} passed, ${failed} failed (총 ${results.length}건) ===\n`);

  if (failed > 0) {
    console.log('실패 항목:');
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  - ${r.name}: ${r.error ?? `status ${r.status}`}`);
    }
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
