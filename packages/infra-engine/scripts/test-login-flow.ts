#!/usr/bin/env pnpm exec tsx
/**
 * E2E 로그인 흐름 테스트
 *
 * 전체 인증 파이프라인을 검증한다:
 *
 * 1. Zitadel 토큰 획득 (machine key JWT bearer)
 * 2. Enrichment 서버에서 JWT 교환 (POST /token)
 * 3. Enrichment JWT로 gateway 접근
 * 4. Gateway를 통한 서비스 프록시 (ingest-server)
 * 5. Gateway를 통한 이벤트 전송
 *
 * 실행: pnpm exec tsx scripts/test-login-flow.ts
 *
 * 환경변수:
 *   ZITADEL_URL       — Zitadel 인스턴스 (기본: http://localhost:8085)
 *   ENRICHMENT_URL    — Enrichment 서버 (기본: http://localhost:3900)
 *   GATEWAY_JWT_URL   — JWT 모드 gateway (기본: http://localhost:28788)
 *   ZITADEL_TOKEN     — 사전 발급된 Zitadel access_token (없으면 machine key 흐름 시도)
 *   MACHINE_KEY_PATH  — Zitadel machine key JSON 경로
 */

import { createHmac } from "node:crypto";

const ZITADEL_URL = process.env.ZITADEL_URL ?? "http://localhost:8085";
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(5_000),
    });
    let data: T | null = null;
    try { data = await res.json() as T; } catch { /* no body */ }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Zitadel machine key로 JWT bearer grant를 시도한다.
 * 성공 시 access_token 반환, 실패 시 null.
 */
async function getZitadelTokenViaJwtBearer(keyPath: string): Promise<string | null> {
  try {
    const fs = await import("node:fs/promises");
    const keyData = JSON.parse(await fs.readFile(keyPath, "utf-8")) as {
      userId: string;
      keyId: string;
      key: string;
    };

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: keyData.keyId })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: keyData.userId,
      sub: keyData.userId,
      aud: ZITADEL_URL,
      iat: now,
      exp: now + 3600,
    })).toString("base64url");

    const { createSign } = await import("node:crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(keyData.key, "base64url");
    const jwt = `${header}.${payload}.${sig}`;

    const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        scope: "openid profile email",
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) return null;
    const data = await res.json() as { access_token: string };
    return data.access_token;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log("\n========================================");
  console.log("  E2E 로그인 흐름 테스트");
  console.log("========================================\n");

  // ── 0. 서비스 가용성 확인 ─────────────────────────

  console.log("--- [0] 서비스 가용성 확인 ---");

  const enrichHealth = await fetchJson<{ status: string }>(`${ENRICHMENT_URL}/health`);
  if (!enrichHealth.ok) {
    log("FAIL", "Enrichment 서버 접근 불가", ENRICHMENT_URL);
    console.log("\n  Enrichment 서버가 실행 중이어야 합니다.");
    console.log("  pnpm exec tsx src/auth/enrichment-server.ts\n");
    process.exit(1);
  }
  log("PASS", "Enrichment 서버 정상", `${ENRICHMENT_URL}`);

  let gatewayAvailable = false;
  const gwHealth = await fetchJson(`${GATEWAY_JWT_URL}/health`);
  if (gwHealth.ok) {
    gatewayAvailable = true;
    log("PASS", "Gateway (JWT 모드) 정상", `${GATEWAY_JWT_URL}`);
  } else {
    log("SKIP", "Gateway (JWT 모드) 미실행", "gateway 테스트 스킵");
  }

  let zitadelAvailable = false;
  try {
    const zRes = await fetch(`${ZITADEL_URL}/healthz`, { signal: AbortSignal.timeout(2_000) });
    zitadelAvailable = zRes.ok;
  } catch { /* Zitadel 미실행 */ }
  if (zitadelAvailable) {
    log("PASS", "Zitadel 정상", ZITADEL_URL);
  } else {
    log("SKIP", "Zitadel 미실행", "토큰 교환 테스트는 로컬 모드 사용");
  }

  // ── 1. Zitadel 토큰 획득 ─────────────────────────

  console.log("\n--- [1] Zitadel 토큰 획득 ---");

  let zitadelToken = process.env.ZITADEL_TOKEN ?? null;

  if (!zitadelToken && process.env.MACHINE_KEY_PATH) {
    zitadelToken = await getZitadelTokenViaJwtBearer(process.env.MACHINE_KEY_PATH);
    if (zitadelToken) {
      log("PASS", "Machine key JWT bearer grant 성공");
    } else {
      log("FAIL", "Machine key JWT bearer grant 실패");
    }
  }

  if (!zitadelToken && zitadelAvailable) {
    log("SKIP", "Zitadel 토큰 없음", "ZITADEL_TOKEN 또는 MACHINE_KEY_PATH 필요");
  }

  // ── 2. Token Exchange (Zitadel → Enrichment JWT) ──

  console.log("\n--- [2] Token Exchange ---");

  let enrichmentJwt: string | null = null;

  if (zitadelToken) {
    // 실제 Zitadel 토큰으로 교환
    const tokenRes = await fetchJson<{ token: string; expires_in: number }>(
      `${ENRICHMENT_URL}/token`,
      { method: "POST", body: JSON.stringify({ zitadel_token: zitadelToken }) },
    );

    if (tokenRes.ok && tokenRes.data?.token) {
      enrichmentJwt = tokenRes.data.token;
      log("PASS", "Token exchange 성공", `expires_in: ${tokenRes.data.expires_in}s`);

      // JWT 구조 검증
      const parts = enrichmentJwt.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        const hasPerms = payload.perms != null;
        const hasIss = payload.iss === "qa-enrichment";
        log(hasPerms && hasIss ? "PASS" : "FAIL", "JWT claims 검증",
          `iss=${payload.iss}, perms=${hasPerms ? "present" : "missing"}`);
      } else {
        log("FAIL", "JWT 형식 오류");
      }
    } else {
      log("FAIL", "Token exchange 실패", `status: ${tokenRes.status}`);
    }
  }

  // Zitadel 미실행 시 로컬 모드: enrichment의 /enrich로 직접 bitmask 획득, test-jwt로 JWT 생성
  if (!enrichmentJwt) {
    console.log("  로컬 모드: test-jwt 유틸로 JWT 직접 생성");

    // enrichment에서 bitmask 획득
    const enrichRes = await fetchJson<{ perms: Record<string, string>; perms_v: number; perms_schema: string }>(
      `${ENRICHMENT_URL}/enrich`,
      { method: "POST", body: JSON.stringify({ userId: "e2e-test-user" }) },
    );

    if (enrichRes.ok && enrichRes.data?.perms) {
      // HS256 JWT 직접 생성 (enrichment 서버의 JWT_SECRET 사용)
      const secret = process.env.ENRICHMENT_JWT_SECRET ?? "enrichment-local-dev-secret-32ch";
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: "qa-enrichment",
        sub: "e2e-test-user",
        email: "e2e@test.local",
        perms: enrichRes.data.perms,
        perms_v: enrichRes.data.perms_v,
        perms_schema: enrichRes.data.perms_schema,
        iat: now,
        exp: now + 43200,
      };

      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = createHmac("sha256", secret).update(`${header}.${payloadB64}`).digest("base64url");
      enrichmentJwt = `${header}.${payloadB64}.${signature}`;

      log("PASS", "로컬 Enrichment JWT 생성", `perms: ${JSON.stringify(enrichRes.data.perms)}`);
    } else {
      log("FAIL", "Enrichment bitmask 조회 실패");
    }
  }

  if (!enrichmentJwt) {
    console.log("\n  JWT 생성 실패 — 이후 테스트 스킵\n");
    process.exit(1);
  }

  // ── 3. Enrichment JWT로 Gateway 접근 ──────────────

  console.log("\n--- [3] Gateway 인증 ---");

  if (gatewayAvailable) {
    // 3a. 유효한 enrichment JWT → 200
    const healthRes = await fetchJson(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${enrichmentJwt}` },
    });
    log(healthRes.ok ? "PASS" : "FAIL", "Enrichment JWT → gateway /health",
      `status: ${healthRes.status}`);

    // 3b. JWT 없이 → 401
    const noAuth = await fetchJson(`${GATEWAY_JWT_URL}/v1/sessions`);
    log(noAuth.status === 401 ? "PASS" : "FAIL", "JWT 없이 → 401",
      `status: ${noAuth.status}`);

    // 3c. 위조 JWT → 401
    const fakeJwt = enrichmentJwt.slice(0, -5) + "XXXXX";
    const fakeRes = await fetchJson(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${fakeJwt}` },
    });
    log(fakeRes.status === 401 ? "PASS" : "FAIL", "위조 JWT → 401",
      `status: ${fakeRes.status}`);

    // 3d. 만료 JWT → 401
    const expiredPayload = {
      iss: "qa-enrichment", sub: "expired-user",
      perms: { infra: "//8=" }, perms_v: 1, perms_schema: "qa-v1",
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const secret = process.env.ENRICHMENT_JWT_SECRET ?? "enrichment-local-dev-secret-32ch";
    const expH = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const expP = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
    const expS = createHmac("sha256", secret).update(`${expH}.${expP}`).digest("base64url");
    const expiredJwt = `${expH}.${expP}.${expS}`;

    const expRes = await fetchJson(`${GATEWAY_JWT_URL}/health`, {
      headers: { Authorization: `Bearer ${expiredJwt}` },
    });
    log(expRes.status === 401 ? "PASS" : "FAIL", "만료 JWT → 401",
      `status: ${expRes.status}`);
  } else {
    log("SKIP", "Gateway 미실행 — 인증 테스트 스킵");
  }

  // ── 4. Gateway 프록시 통한 서비스 접근 ────────────

  console.log("\n--- [4] Gateway 프록시 ---");

  if (gatewayAvailable) {
    // Sessions 조회 (ingest-server 프록시)
    const sessRes = await fetchJson(`${GATEWAY_JWT_URL}/v1/sessions`, {
      headers: { Authorization: `Bearer ${enrichmentJwt}` },
    });
    if (sessRes.ok) {
      log("PASS", "Gateway → ingest sessions 프록시", `status: ${sessRes.status}`);
    } else if (sessRes.status === 502) {
      log("SKIP", "Gateway → ingest 502 (ingest-server 미실행)", "프록시 연결만 확인");
    } else {
      log("FAIL", "Gateway → ingest sessions", `status: ${sessRes.status}`);
    }
  } else {
    log("SKIP", "Gateway 미실행 — 프록시 테스트 스킵");
  }

  // ── 5. Gateway 통한 이벤트 전송 ───────────────────

  console.log("\n--- [5] Gateway 이벤트 전송 ---");

  if (gatewayAvailable) {
    const txId = `e2e-login-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ingestBody = JSON.stringify({
      transmission_id: txId,
      sent_at: new Date().toISOString(),
      owner: { owner_type: "agent", owner_id: "e2e-login-test" },
      source: { service_name: "e2e-login-test", sdk_name: "test", sdk_version: "1.0" },
      runtime: { platform: "node" },
      build: { env: "dev" },
      records: [{
        log_id: `e2e-${Date.now()}`,
        timestamp: new Date().toISOString(),
        record_kind: "log",
        trace_id: "e2e-trace",
        span_id: "e2e-span",
        event_key: "auth_test_event",
        event_version: "001",
        payload_format: "json",
        payload_encoding: "raw",
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { flow: "login-e2e", step: "final" },
      }],
    });

    const ingestRes = await fetchJson(`${GATEWAY_JWT_URL}/v1/ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${enrichmentJwt}` },
      body: ingestBody,
    });

    if (ingestRes.status === 202) {
      log("PASS", "Gateway → ingest POST 이벤트 전송", "202 Accepted");
    } else if (ingestRes.status === 502) {
      log("SKIP", "Gateway → ingest 502 (ingest-server 미실행)");
    } else {
      log("FAIL", "Gateway → ingest POST", `status: ${ingestRes.status}`);
    }
  } else {
    log("SKIP", "Gateway 미실행 — 이벤트 전송 스킵");
  }

  // ── 6. Token Exchange 에러 케이스 ─────────────────

  console.log("\n--- [6] Token Exchange 에러 케이스 ---");

  // 빈 body
  const emptyRes = await fetchJson(`${ENRICHMENT_URL}/token`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  log(emptyRes.status === 400 ? "PASS" : "FAIL", "빈 body → 400",
    `status: ${emptyRes.status}`);

  // 잘못된 Zitadel 토큰
  const badTokenRes = await fetchJson<{ error: string }>(
    `${ENRICHMENT_URL}/token`,
    { method: "POST", body: JSON.stringify({ zitadel_token: "invalid-opaque-token" }) },
  );
  // Zitadel 미실행 시 502, 실행 중이면 401
  const badTokenOk = badTokenRes.status === 401 || badTokenRes.status === 502;
  log(badTokenOk ? "PASS" : "FAIL", "잘못된 Zitadel 토큰 → 401/502",
    `status: ${badTokenRes.status}, error: ${badTokenRes.data?.error}`);

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
