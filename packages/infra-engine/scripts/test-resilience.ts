#!/usr/bin/env pnpm exec tsx
/**
 * 장애 복구 + 탄력성 테스트
 *
 * 다양한 실패 시나리오에서 시스템이 graceful하게 동작하는지 검증한다.
 *
 * 테스트 시나리오:
 *  1. 잘못된 토큰 변형 (위조, 만료, 잘린 토큰, 빈 페이로드)
 *  2. Enrichment 서버 장애 시 gateway 동작
 *  3. Zitadel 장애 시 token exchange 동작
 *  4. 동시 요청 처리
 *  5. 대량 토큰 검증 성능
 *
 * 실행: pnpm exec tsx scripts/test-resilience.ts
 *
 * 환경변수:
 *   ENRICHMENT_URL    — Enrichment 서버 (기본: http://localhost:3900)
 *   GATEWAY_JWT_URL   — JWT 모드 gateway (기본: http://localhost:28788)
 */

import { createHmac } from "node:crypto";

const ENRICHMENT_URL = process.env.ENRICHMENT_URL ?? "http://localhost:3900";
const GATEWAY_JWT_URL = process.env.GATEWAY_JWT_URL ?? "http://localhost:28788";

let passed = 0;
let failed = 0;
let skipped = 0;

function log(status: "PASS" | "FAIL" | "SKIP", name: string, detail?: string): void {
  const prefix = status === "PASS" ? "  [PASS]" : status === "FAIL" ? "  [FAIL]" : "  [SKIP]";
  console.log(`${prefix} ${name}${detail ? ` — ${detail}` : ""}`);
  if (status === "PASS") passed++;
  else if (status === "FAIL") failed++;
  else skipped++;
}

async function fetchSafe(url: string, init?: RequestInit): Promise<{ status: number; body: string | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(5_000),
    });
    const body = await res.text().catch(() => null);
    return { status: res.status, body, error: null };
  } catch (err) {
    return { status: 0, body: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function makeHS256Jwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${header}.${payloadB64}`).digest("base64url");
  return `${header}.${payloadB64}.${sig}`;
}

const SECRET = process.env.ENRICHMENT_JWT_SECRET ?? "enrichment-local-dev-secret-32ch";

function makeValidJwt(sub: string = "resilience-test"): string {
  const now = Math.floor(Date.now() / 1000);
  return makeHS256Jwt({
    iss: "qa-enrichment",
    sub,
    perms: { infra: "//8=" }, // 모든 비트 on
    perms_v: 1,
    perms_schema: "qa-v1",
    iat: now,
    exp: now + 3600,
  }, SECRET);
}

async function main(): Promise<void> {
  console.log("\n========================================");
  console.log("  장애 복구 + 탄력성 테스트");
  console.log("========================================\n");

  // ── 서비스 가용성 확인 ────────────────────────────

  const enrichOk = (await fetchSafe(`${ENRICHMENT_URL}/health`)).status === 200;
  if (!enrichOk) {
    console.log("  Enrichment 서버 미실행 — 일부 테스트 스킵\n");
  }

  let gatewayOk = false;
  const gwRes = await fetchSafe(`${GATEWAY_JWT_URL}/health`);
  gatewayOk = gwRes.status === 200;
  if (!gatewayOk) {
    console.log("  Gateway (JWT 모드) 미실행 — gateway 테스트 스킵\n");
  }

  // ══════════════════════════════════════════════════
  // 1. 잘못된 토큰 변형
  // ══════════════════════════════════════════════════

  console.log("--- [1] 잘못된 토큰 변형 ---");

  if (gatewayOk) {
    // 1a. 완전히 잘못된 문자열
    const r1 = await fetchSafe(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    log(r1.status === 401 ? "PASS" : "FAIL", "잘못된 문자열 → 401", `status: ${r1.status}`);

    // 1b. 2파트 JWT (서명 누락)
    const r2 = await fetchSafe(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0" },
    });
    log(r2.status === 401 ? "PASS" : "FAIL", "2파트 JWT → 401", `status: ${r2.status}`);

    // 1c. 올바른 형식이지만 잘못된 서명
    const wrongSecret = makeHS256Jwt({
      iss: "qa-enrichment", sub: "wrong-secret",
      perms: { infra: "//8=" }, perms_v: 1, perms_schema: "qa-v1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, "wrong-secret-key-that-doesnt-match");

    const r3 = await fetchSafe(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${wrongSecret}` },
    });
    log(r3.status === 401 ? "PASS" : "FAIL", "잘못된 서명 → 401", `status: ${r3.status}`);

    // 1d. 만료된 JWT
    const expired = makeHS256Jwt({
      iss: "qa-enrichment", sub: "expired",
      perms: { infra: "//8=" }, perms_v: 1, perms_schema: "qa-v1",
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
    }, SECRET);

    const r4 = await fetchSafe(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${expired}` },
    });
    log(r4.status === 401 ? "PASS" : "FAIL", "만료 JWT → 401", `status: ${r4.status}`);

    // 1e. perms 없는 JWT
    const noPerms = makeHS256Jwt({
      iss: "qa-enrichment", sub: "no-perms",
      perms_v: 1, perms_schema: "qa-v1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, SECRET);

    const r5 = await fetchSafe(`${GATEWAY_JWT_URL}/v1/sessions`, {
      headers: { Authorization: `Bearer ${noPerms}` },
    });
    // perms 없으면 403 (enrichment URL 설정 여부에 따라 enrichment 조회 시도할 수 있음)
    log(r5.status === 403 || r5.status === 200 ? "PASS" : "FAIL",
      "perms 없는 JWT → 403 또는 enrichment 보충 후 200", `status: ${r5.status}`);

    // 1f. Base64가 아닌 페이로드
    const garbage = `eyJhbGciOiJIUzI1NiJ9.not_valid_base64!!!.abc123`;
    const r6 = await fetchSafe(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${garbage}` },
    });
    log(r6.status === 401 ? "PASS" : "FAIL", "잘못된 base64 페이로드 → 401", `status: ${r6.status}`);

    // 1g. 빈 Authorization 헤더
    const r7 = await fetchSafe(`${GATEWAY_JWT_URL}/v1/sessions`, {
      headers: { Authorization: "" },
    });
    log(r7.status === 401 ? "PASS" : "FAIL", "빈 Authorization → 401", `status: ${r7.status}`);

    // 1h. Bearer 없이 토큰만
    const validJwt = makeValidJwt();
    const r8 = await fetchSafe(`${GATEWAY_JWT_URL}/v1/sessions`, {
      headers: { Authorization: validJwt },
    });
    log(r8.status === 401 ? "PASS" : "FAIL", "Bearer prefix 없이 → 401", `status: ${r8.status}`);
  } else {
    log("SKIP", "Gateway 미실행 — 토큰 변형 테스트 스킵");
  }

  // ══════════════════════════════════════════════════
  // 2. Enrichment 서버 장애 시 동작
  // ══════════════════════════════════════════════════

  console.log("\n--- [2] Enrichment 서버 장애 시 동작 ---");

  if (enrichOk) {
    // 2a. 잘못된 JSON body → enrichment가 400 반환
    const r1 = await fetchSafe(`${ENRICHMENT_URL}/token`, {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "text/plain" },
    });
    log(r1.status === 400 || r1.status === 415 ? "PASS" : "FAIL",
      "잘못된 JSON body → 4xx", `status: ${r1.status}`);

    // 2b. 빈 zitadel_token → 400
    const r2 = await fetchSafe(`${ENRICHMENT_URL}/token`, {
      method: "POST",
      body: JSON.stringify({ zitadel_token: "" }),
    });
    log(r2.status === 400 ? "PASS" : "FAIL", "빈 zitadel_token → 400", `status: ${r2.status}`);

    // 2c. Zitadel 미실행 상태에서 token exchange → 502 (userinfo 실패)
    const r3 = await fetchSafe(`${ENRICHMENT_URL}/token`, {
      method: "POST",
      body: JSON.stringify({ zitadel_token: "some-opaque-token" }),
    });
    // Zitadel 미실행이면 502 또는 timeout, 실행 중이면 401
    const r3ok = r3.status === 502 || r3.status === 401;
    log(r3ok ? "PASS" : "FAIL", "Zitadel unreachable → 502/401", `status: ${r3.status}`);

    // 2d. /enrich는 Zitadel 없이도 동작 (role 기반 계산)
    const r4 = await fetchSafe(`${ENRICHMENT_URL}/enrich`, {
      method: "POST",
      body: JSON.stringify({ userId: "resilience-user" }),
    });
    log(r4.status === 200 ? "PASS" : "FAIL", "/enrich Zitadel 없이 정상 동작", `status: ${r4.status}`);
  } else {
    log("SKIP", "Enrichment 미실행 — 장애 테스트 스킵");
  }

  // ══════════════════════════════════════════════════
  // 3. Gateway 서비스 프록시 장애
  // ══════════════════════════════════════════════════

  console.log("\n--- [3] Gateway 서비스 프록시 장애 ---");

  if (gatewayOk) {
    const jwt = makeValidJwt();

    // 3a. 미등록 경로 → 404 (크래시 안 함)
    const r1 = await fetchSafe(`${GATEWAY_JWT_URL}/nonexistent/path`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    log(r1.status === 404 ? "PASS" : "FAIL", "미등록 경로 → 404 (no crash)", `status: ${r1.status}`);

    // 3b. 백엔드 서비스 미실행 → 502 (no crash)
    const r2 = await fetchSafe(`${GATEWAY_JWT_URL}/gate/v1/status`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    // gate-service가 실행 중이면 200, 아니면 502
    log(r2.status === 502 || r2.status === 200 ? "PASS" : "FAIL",
      "백엔드 서비스 다운 → 502 또는 200", `status: ${r2.status}`);

    // 3c. health는 프록시 없이 직접 응답 → 항상 200
    const r3 = await fetchSafe(`${GATEWAY_JWT_URL}/health`);
    log(r3.status === 200 ? "PASS" : "FAIL", "/health 항상 200 (프록시 무관)", `status: ${r3.status}`);
  } else {
    log("SKIP", "Gateway 미실행 — 프록시 장애 테스트 스킵");
  }

  // ══════════════════════════════════════════════════
  // 4. 동시 요청 처리
  // ══════════════════════════════════════════════════

  console.log("\n--- [4] 동시 요청 처리 ---");

  if (enrichOk) {
    // 10개 동시 enrich 요청
    const concurrentCount = 10;
    const promises = Array.from({ length: concurrentCount }, (_, i) =>
      fetchSafe(`${ENRICHMENT_URL}/enrich`, {
        method: "POST",
        body: JSON.stringify({ userId: `concurrent-user-${i}` }),
      }),
    );

    const results = await Promise.all(promises);
    const allOk = results.every((r) => r.status === 200);
    log(allOk ? "PASS" : "FAIL",
      `동시 ${concurrentCount}개 enrich 요청`,
      `성공: ${results.filter(r => r.status === 200).length}/${concurrentCount}`);
  }

  if (gatewayOk) {
    // 10개 동시 gateway 요청 (다른 유저)
    const concurrentCount = 10;
    const promises = Array.from({ length: concurrentCount }, (_, i) => {
      const jwt = makeValidJwt(`concurrent-${i}`);
      return fetchSafe(`${GATEWAY_JWT_URL}/health`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
    });

    const results = await Promise.all(promises);
    const allOk = results.every((r) => r.status === 200);
    log(allOk ? "PASS" : "FAIL",
      `동시 ${concurrentCount}개 gateway 요청`,
      `성공: ${results.filter(r => r.status === 200).length}/${concurrentCount}`);
  }

  // ══════════════════════════════════════════════════
  // 5. 대량 토큰 검증 성능
  // ══════════════════════════════════════════════════

  console.log("\n--- [5] 토큰 검증 성능 ---");

  if (gatewayOk) {
    const iterations = 50;
    const jwt = makeValidJwt();

    const start = performance.now();
    const promises = Array.from({ length: iterations }, () =>
      fetchSafe(`${GATEWAY_JWT_URL}/health`, {
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    const results = await Promise.all(promises);
    const elapsed = performance.now() - start;

    const successCount = results.filter((r) => r.status === 200).length;
    const avgMs = (elapsed / iterations).toFixed(1);
    const opsPerSec = Math.floor(iterations / (elapsed / 1000));

    log(successCount === iterations ? "PASS" : "FAIL",
      `${iterations}건 JWT 검증 성능`,
      `${elapsed.toFixed(0)}ms 총, 평균 ${avgMs}ms/req, ~${opsPerSec} ops/s, 성공: ${successCount}/${iterations}`);
  } else {
    log("SKIP", "Gateway 미실행 — 성능 테스트 스킵");
  }

  // ══════════════════════════════════════════════════
  // 6. 세션 무효화 후 토큰 재사용
  // ══════════════════════════════════════════════════

  console.log("\n--- [6] 세션 무효화 + 토큰 재사용 ---");

  if (enrichOk) {
    const userId = `invalidation-test-${Date.now()}`;

    // 유저 초기화 + enrich
    const enrichRes1 = await fetchSafe(`${ENRICHMENT_URL}/enrich`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    log(enrichRes1.status === 200 ? "PASS" : "FAIL", "초기 enrich 성공", `status: ${enrichRes1.status}`);

    // 세션 무효화
    const invRes = await fetchSafe(`${ENRICHMENT_URL}/users/${userId}/invalidate`, {
      method: "POST",
    });
    log(invRes.status === 200 ? "PASS" : "FAIL", "세션 무효화 성공");

    // 무효화 후 check → denied
    const checkRes = await fetchSafe(`${ENRICHMENT_URL}/check`, {
      method: "POST",
      body: JSON.stringify({ userId, feature: "ingest_read" }),
    });
    const checkData = checkRes.body ? JSON.parse(checkRes.body) as { granted: boolean; reason: string } : null;
    log(
      checkData?.granted === false && checkData?.reason === "session_invalidated" ? "PASS" : "FAIL",
      "무효화 후 check → session_invalidated",
      `granted: ${checkData?.granted}, reason: ${checkData?.reason}`,
    );

    // 재활성화
    const actRes = await fetchSafe(`${ENRICHMENT_URL}/users/${userId}/activate`, {
      method: "POST",
    });
    log(actRes.status === 200 ? "PASS" : "FAIL", "재활성화 성공");

    // 재활성화 후 check → granted
    const checkRes2 = await fetchSafe(`${ENRICHMENT_URL}/check`, {
      method: "POST",
      body: JSON.stringify({ userId, feature: "ingest_read" }),
    });
    const checkData2 = checkRes2.body ? JSON.parse(checkRes2.body) as { granted: boolean } : null;
    log(checkData2?.granted === true ? "PASS" : "FAIL", "재활성화 후 check → granted");
  } else {
    log("SKIP", "Enrichment 미실행 — 세션 무효화 테스트 스킵");
  }

  // ── 결과 요약 ────────────────────────────────────

  const total = passed + failed + skipped;
  console.log("\n========================================");
  console.log(`  결과: ${passed} passed, ${failed} failed, ${skipped} skipped (총 ${total}건)`);
  console.log("========================================\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("테스트 실행 실패:", err);
  process.exit(1);
});
