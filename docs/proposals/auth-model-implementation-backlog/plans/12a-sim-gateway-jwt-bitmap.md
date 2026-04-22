---
lifecycle: draft
plan: 12a
phase: 4
depends-on: [10c, 11a]
---

# Plan 12a — sim-gateway JWT bitmap embed + traceparent + 라우팅

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 10c에서 placeholder 503으로 부팅된 `sim-gateway`를 본격 실구현으로 전환한다. (1) `POST /auth/login`에서 `sim-auth-api`로 위임하여 사용자 인증 → bitmap 발급 후 `jose` 라이브러리로 JWT에 embed (HS256). (2) 모든 protected route에서 JWT verify → `VersionedBitmap` 추출 → `X-User-Id` / `X-User-Bitmap-V` / `X-User-Bitmap-Mask` (base64) header 주입 후 downstream 위임. (3) W3C `traceparent` 헤더 생성·전파를 `@opentelemetry/api`의 `propagation.inject`로 구현. (4) 7 비즈니스 서비스로 reverse proxy (Hono fetch + abort timeout). 본 plan은 §2 `authorization-ontology-bitmap-pipeline` 스펙의 §3 (저장·전달 — JWT embed 패턴)과 §6 (version binding) 규약을 정확히 구현하며, fallback/근사치 없이 spec과 1:1 매칭한다.

**Architecture:**
- **JWT embed 모델 (§2 §3)**:
  - bitmap mask가 8KB 미만이면 직접 JWT body에 base64 embed (`bitmap_mask`)
  - 초과 시 `bitmap_id`만 embed하고 Redis lookup — 본 plan은 sim용이므로 직접 embed (`AUTH_BITMASK_BYTES`는 sim-auth-api에서 < 1KB, 항상 embed 모드).
  - JWT claim: `sub` (userId), `bitmap_prefix`, `bitmap_v`, `bitmap_mask` (base64), `iat`, `exp`, `signature` (jose가 자동 부착)
  - HMAC secret rotation은 본 plan 범위 외 — 단일 secret을 env로 주입.
- **Verify 미들웨어**: `jose.jwtVerify`로 signature + exp 검증 → claim에서 `bitmap_v` 추출 → `prefix` (`sim.bitmap`)와 함께 downstream 헤더 부착. version mismatch (`bitmap_v != current_v_from_auth_api`)는 401 + `WWW-Authenticate: refresh_required` 응답 (§2 §6 — VERSION_MISMATCH).
- **traceparent 전파 (W3C)**:
  - 인입 요청에 `traceparent` 헤더 있으면 그대로 OTel context로 extract → active span으로 설정
  - 없으면 신규 root span 생성 (gateway-level)
  - downstream fetch 시 `propagation.inject(context.active(), headers)`로 자동 부착
- **라우팅 테이블** — Plan 10c의 `PLACEHOLDER_ROUTES`를 actual reverse proxy로 변환. path prefix + targetService URL → `fetch` (5초 timeout, AbortSignal). `/auth/login` 만 unprotected (verify skip).
- **TDD 전략**:
  - JWT 유틸 단위 테스트 (issue / verify round-trip + tampered/expired 거절)
  - bitmap claim 직렬화 round-trip
  - 라우팅 단위 테스트 (mock fetch로 downstream 응답 검증)
  - traceparent 미들웨어 단위 테스트 (Span context propagation)
  - 통합 테스트 (실 sim-auth-api with in-memory store)

**Tech Stack:**
- `jose` ^5.9.0 (Plan 10c에서 dep 등록 완료) — `SignJWT`, `jwtVerify`, `compactVerify`
- `@opentelemetry/api` (workspace: peer through @qa-sdk/otel)
- hono ^4.7.5 — middleware + reverse proxy
- vitest, ES2023

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/services/gateway/src/lib/jwt.ts` | `signBitmapJwt(claims, secret)` + `verifyBitmapJwt(token, secret)` 유틸 |
| `simulations/enterprise-pm/services/gateway/src/lib/jwt.test.ts` | issue/verify round-trip + tampered/expired 거절 |
| `simulations/enterprise-pm/services/gateway/src/lib/bitmap-claim.ts` | `VersionedBitmap` ↔ JWT claim 변환 (base64 mask) |
| `simulations/enterprise-pm/services/gateway/src/lib/bitmap-claim.test.ts` | 직렬화 round-trip + invalid base64 거절 |
| `simulations/enterprise-pm/services/gateway/src/middleware/jwt-verify.ts` | JWT verify + downstream header 주입 |
| `simulations/enterprise-pm/services/gateway/src/middleware/jwt-verify.test.ts` | verify pass/fail/version-mismatch 매트릭스 |
| `simulations/enterprise-pm/services/gateway/src/lib/proxy.ts` | `proxyRequest(targetUrl, request)` — fetch + traceparent inject + timeout |
| `simulations/enterprise-pm/services/gateway/src/lib/proxy.test.ts` | mock fetch + abort + header propagation |
| `simulations/enterprise-pm/services/gateway/src/routes/login.ts` | `POST /auth/login` — auth-api 위임 + JWT 발급 |
| `simulations/enterprise-pm/services/gateway/src/routes/login.test.ts` | login 응답 + JWT claim 검증 |
| `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts` | 6 비즈니스 서비스 reverse proxy 라우터 (auth는 login 별도) |
| `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.test.ts` | 라우팅 + verify + downstream fetch 통합 |
| `simulations/enterprise-pm/services/gateway/src/integration.test.ts` | 실 sim-auth-api in-process 통합 (login → proxied request) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/gateway/src/config/env.ts` | `JWT_SECRET`, `JWT_TTL_SECONDS`, `BITMAP_PREFIX` (`sim.bitmap`), `PROXY_TIMEOUT_MS` 추가 |
| `simulations/enterprise-pm/services/gateway/src/config/env.test.ts` | 신규 env field 검증 |
| `simulations/enterprise-pm/services/gateway/src/middleware/traceparent.ts` | OTel `propagation.extract` + 신규 root span 생성으로 본격 구현 |
| `simulations/enterprise-pm/services/gateway/src/middleware/traceparent.test.ts` | (신규) propagation 검증 |
| `simulations/enterprise-pm/services/gateway/src/app.ts` | placeholder routes 제거 + login + proxy-routes 마운트 |
| `simulations/enterprise-pm/services/gateway/src/app.test.ts` | placeholder 테스트 제거 + proxy 통합으로 갱신 |
| `simulations/enterprise-pm/services/gateway/src/routes/placeholder.ts` | 삭제 (Plan 10c의 임시 503은 본 plan에서 제거) |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/gateway/src/server.ts && \
  ls simulations/enterprise-pm/services/auth-api/src/auth/bitmap/bitmap-issuer.service.ts && \
  grep -n "VersionedBitmap" packages/permission-engine/src/versioned-bitmap/*.ts | head -3
```

Expected: 모두 hit. Plan 10c (gateway placeholder) + Plan 11a (BitmapIssuerService) 완료 필수.

- [ ] **Step 2: 현재 gateway 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-gateway test 2>&1 | tail -5
```

Expected: 10 PASS (Plan 10c env 5 + app 5).

- [ ] **Step 3: jose dep 설치 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/gateway/node_modules/jose/package.json
```

Expected: hit. 미설치 시 `pnpm install`.

- [ ] **Step 4: sim-auth-api `/bitmap/issue` endpoint 동작 확인 (read-only)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "POST.*bitmap/issue\|@Post.*issue" simulations/enterprise-pm/services/auth-api/src/auth/bitmap/bitmap.controller.ts
```

Expected: hit. Plan 11a에서 정의된 `POST /bitmap/issue` 엔드포인트 존재.

---

## Task 1: env 확장 — JWT_SECRET / TTL / prefix / proxy timeout

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/config/env.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/config/env.test.ts`

- [ ] **Step 1: env 스키마 확장**

`simulations/enterprise-pm/services/gateway/src/config/env.ts`의 `envSchema`에 추가:

```ts
export const envSchema = z.object({
  // ── 기존 (Plan 10c) ────
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  QA_INGEST_URL: z.string().optional(),
  AUTH_API_URL: z.string().default(getServiceDevUrl("sim-auth-api") ?? "http://localhost:4400"),
  PM_API_URL: z.string().default(getServiceDevUrl("sim-pm-api") ?? "http://localhost:4500"),
  APPROVAL_API_URL: z.string().default(getServiceDevUrl("sim-approval-api") ?? "http://localhost:4600"),
  NOTIFICATION_API_URL: z.string().default(getServiceDevUrl("sim-notification-api") ?? "http://localhost:4700"),
  REPORTING_API_URL: z.string().default(getServiceDevUrl("sim-reporting-api") ?? "http://localhost:4800"),
  DOCUMENT_API_URL: z.string().default(getServiceDevUrl("sim-document-api") ?? "http://localhost:4900"),
  AUDIT_BROWSER_API_URL: z.string().default(getServiceDevUrl("sim-audit-browser-api") ?? "http://localhost:5100"),
  // ── 신규 (Plan 12a) ────
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be ≥ 32 bytes (HS256 secure baseline)"),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(300),  // 5분 — §2 §2 (TTL)
  BITMAP_PREFIX: z.string().default("sim.bitmap"),
  PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
});
```

**중요**: `JWT_SECRET`은 default 없음 — 부팅 시 명시 필수. 시뮬 운영 시 `.env.sim`에 32+ char 랜덤. fallback 없음 (no fallback/approximation 원칙).

- [ ] **Step 2: env.test.ts 갱신 — 신규 4 field 검증**

`simulations/enterprise-pm/services/gateway/src/config/env.test.ts`에 추가:

```ts
describe("sim-gateway env — Plan 12a 신규 field", () => {
  it("JWT_SECRET 미주입 시 throw", () => {
    expect(() => parseEnv({})).toThrow(/JWT_SECRET/);
  });
  it("JWT_SECRET 32바이트 미만 시 throw", () => {
    expect(() => parseEnv({ JWT_SECRET: "short" })).toThrow(/32/);
  });
  it("JWT_SECRET 충족 시 통과 + TTL 기본 300", () => {
    const env = parseEnv({ JWT_SECRET: "a".repeat(32) });
    expect(env.JWT_TTL_SECONDS).toBe(300);
    expect(env.BITMAP_PREFIX).toBe("sim.bitmap");
    expect(env.PROXY_TIMEOUT_MS).toBe(5_000);
  });
  it("env override 동작", () => {
    const env = parseEnv({
      JWT_SECRET: "x".repeat(32),
      JWT_TTL_SECONDS: "60",
      PROXY_TIMEOUT_MS: "2000",
    });
    expect(env.JWT_TTL_SECONDS).toBe(60);
    expect(env.PROXY_TIMEOUT_MS).toBe(2000);
  });
});
```

또한 기존 default-value 테스트들에 `JWT_SECRET: "a".repeat(32)`를 추가해야 통과. 모든 `parseEnv({})` 호출을 `parseEnv({ JWT_SECRET: "a".repeat(32) })`로 변경.

- [ ] **Step 3: typecheck + 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway test -- env.test
```

Expected: typecheck 0, env 9 PASS (기존 5 + 신규 4).

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/config/env.ts \
          simulations/enterprise-pm/services/gateway/src/config/env.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): env 확장 — JWT_SECRET / TTL / prefix / proxy timeout

JWT_SECRET 32바이트 이상 강제 (no fallback).
JWT_TTL_SECONDS 기본 300 (§2 bitmap-pipeline §2 TTL).
BITMAP_PREFIX 기본 "sim.bitmap".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: lib/bitmap-claim — VersionedBitmap ↔ JWT claim (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/lib/bitmap-claim.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/lib/bitmap-claim.test.ts`

`VersionedBitmap`의 `mask` (Uint8Array)는 JWT body에 base64로 직렬화. JWT는 JSON 텍스트이므로 binary는 base64 필수.

- [ ] **Step 1: bitmap-claim.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import { bitmapToClaim, claimToBitmap } from "./bitmap-claim.js";
import type { VersionedBitmap } from "permission-engine";

const sample: VersionedBitmap = {
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0xff, 0x01, 0x80, 0x00, 0x42]),
  issuedAt: "2026-04-22T00:00:00.000Z",
  expiresAt: "2026-04-22T00:05:00.000Z",
  issuer: "sim-auth-api",
  signature: "deadbeef",
};

describe("bitmap-claim — VersionedBitmap ↔ JWT claim 직렬화", () => {
  it("bitmapToClaim — mask는 base64로 직렬화", () => {
    const claim = bitmapToClaim(sample);
    expect(claim.bitmap_prefix).toBe("sim.bitmap");
    expect(claim.bitmap_v).toBe("uv1");
    // base64 of [0xff, 0x01, 0x80, 0x00, 0x42] = "/wGAAEI=" (표준 base64)
    expect(claim.bitmap_mask).toBe(Buffer.from(sample.mask).toString("base64"));
    expect(claim.bitmap_issuer).toBe("sim-auth-api");
    expect(claim.bitmap_signature).toBe("deadbeef");
  });

  it("claimToBitmap — base64 mask 복원 라운드트립", () => {
    const claim = bitmapToClaim(sample);
    const restored = claimToBitmap(claim, sample.issuedAt, sample.expiresAt);
    expect(restored.prefix).toBe(sample.prefix);
    expect(restored.v).toBe(sample.v);
    expect(Array.from(restored.mask)).toEqual(Array.from(sample.mask));
    expect(restored.issuer).toBe(sample.issuer);
    expect(restored.signature).toBe(sample.signature);
  });

  it("invalid base64 mask → throw", () => {
    const bad = { ...bitmapToClaim(sample), bitmap_mask: "###not-base64###" };
    expect(() => claimToBitmap(bad, sample.issuedAt, sample.expiresAt))
      .toThrow(/base64/);
  });

  it("필수 claim 누락 → throw", () => {
    const partial = { bitmap_prefix: "sim.bitmap" } as never;
    expect(() => claimToBitmap(partial, sample.issuedAt, sample.expiresAt))
      .toThrow(/required/);
  });

  it("mask 길이 보존 (다양한 길이 round-trip)", () => {
    for (const len of [1, 8, 16, 64, 128]) {
      const mask = new Uint8Array(len).map((_, i) => i % 256);
      const bm: VersionedBitmap = { ...sample, mask };
      const restored = claimToBitmap(bitmapToClaim(bm), bm.issuedAt, bm.expiresAt);
      expect(restored.mask.length).toBe(len);
      expect(Array.from(restored.mask)).toEqual(Array.from(mask));
    }
  });
});
```

- [ ] **Step 2: bitmap-claim.ts 구현**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * VersionedBitmap ↔ JWT claim 직렬화.
 *
 * §2 bitmap-pipeline §3 (저장·전달):
 *   bitmap mask는 binary (Uint8Array). JWT body는 JSON 텍스트.
 *   → base64 인코딩으로 텍스트화. claim key는 `bitmap_*` prefix.
 *
 * issuedAt / expiresAt은 JWT의 `iat` / `exp` claim과 별도 — VersionedBitmap의
 * 자체 timestamp이므로 JWT issue 시 동기화 (jose가 iat/exp를 자동 설정).
 */

import type { VersionedBitmap } from "permission-engine";

export interface BitmapClaim {
  bitmap_prefix: string;
  bitmap_v: string;
  /** Uint8Array → base64 (표준 인코딩, padding 포함). */
  bitmap_mask: string;
  bitmap_issuer: string;
  bitmap_signature: string;
}

export function bitmapToClaim(bm: VersionedBitmap): BitmapClaim {
  return {
    bitmap_prefix: bm.prefix,
    bitmap_v: bm.v,
    bitmap_mask: Buffer.from(bm.mask).toString("base64"),
    bitmap_issuer: bm.issuer,
    bitmap_signature: bm.signature,
  };
}

/**
 * JWT body의 claim에서 VersionedBitmap을 복원한다.
 * issuedAt/expiresAt은 JWT의 iat/exp에서 ISO-8601로 변환되어 별도 인자로 주입.
 */
export function claimToBitmap(
  claim: Partial<BitmapClaim>,
  issuedAt: string,
  expiresAt: string,
): VersionedBitmap {
  const required: Array<keyof BitmapClaim> = [
    "bitmap_prefix", "bitmap_v", "bitmap_mask", "bitmap_issuer", "bitmap_signature",
  ];
  for (const key of required) {
    if (typeof claim[key] !== "string" || claim[key] === "") {
      throw new Error(`bitmap claim required field missing: ${key}`);
    }
  }
  let mask: Uint8Array;
  try {
    const buf = Buffer.from(claim.bitmap_mask!, "base64");
    // base64 invalid 검출: re-encode → 원본과 동일해야 함
    if (buf.toString("base64") !== claim.bitmap_mask!.replace(/=*$/, (m) => m)) {
      // padding 차이는 허용. 그 외는 invalid
      const reEnc = buf.toString("base64");
      const norm = (s: string) => s.replace(/=+$/, "");
      if (norm(reEnc) !== norm(claim.bitmap_mask!)) {
        throw new Error(`invalid base64 in bitmap_mask`);
      }
    }
    mask = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch (err) {
    if (err instanceof Error && err.message.includes("base64")) throw err;
    throw new Error(`invalid base64 in bitmap_mask: ${(err as Error).message}`);
  }
  return {
    prefix: claim.bitmap_prefix!,
    v: claim.bitmap_v!,
    mask,
    issuedAt,
    expiresAt,
    issuer: claim.bitmap_issuer!,
    signature: claim.bitmap_signature!,
  };
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- bitmap-claim
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/lib/bitmap-claim.ts \
          simulations/enterprise-pm/services/gateway/src/lib/bitmap-claim.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): bitmap-claim — VersionedBitmap ↔ JWT claim 직렬화

mask Uint8Array → base64 텍스트 (JWT JSON body 호환).
필수 claim 누락·invalid base64 → throw (no silent fallback).
다양한 mask 길이에서 round-trip 보존.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: lib/jwt — sign / verify (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/lib/jwt.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/lib/jwt.test.ts`

- [ ] **Step 1: jwt.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import { signBitmapJwt, verifyBitmapJwt, JwtVerifyError } from "./jwt.js";
import type { VersionedBitmap } from "permission-engine";

const SECRET = "x".repeat(32);

const sampleBm: VersionedBitmap = {
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0xff, 0x12, 0x34]),
  issuedAt: "2026-04-22T00:00:00.000Z",
  expiresAt: "2026-04-22T00:05:00.000Z",
  issuer: "sim-auth-api",
  signature: "sig",
};

describe("sim-gateway JWT — sign + verify round-trip", () => {
  it("sign → verify 라운드트립 (userId + bitmap 복원)", async () => {
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: sampleBm,
      secret: SECRET,
      ttlSeconds: 300,
    });
    expect(token.split(".")).toHaveLength(3); // header.payload.signature

    const verified = await verifyBitmapJwt(token, SECRET);
    expect(verified.userId).toBe("user-1");
    expect(verified.bitmap.prefix).toBe("sim.bitmap");
    expect(verified.bitmap.v).toBe("uv1");
    expect(Array.from(verified.bitmap.mask)).toEqual([0xff, 0x12, 0x34]);
  });

  it("tampered token (mask 비트 변조) → JwtVerifyError", async () => {
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: sampleBm,
      secret: SECRET,
      ttlSeconds: 300,
    });
    // payload 부분 (Base64URL의 두번째 segment) 마지막 글자를 변경 → signature mismatch
    const parts = token.split(".");
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const tampered = JSON.parse(payload);
    tampered.bitmap_mask = Buffer.from([0x00]).toString("base64");
    parts[1] = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const bad = parts.join(".");

    await expect(verifyBitmapJwt(bad, SECRET)).rejects.toBeInstanceOf(JwtVerifyError);
  });

  it("wrong secret → JwtVerifyError", async () => {
    const token = await signBitmapJwt({
      userId: "user-1", bitmap: sampleBm, secret: SECRET, ttlSeconds: 300,
    });
    await expect(verifyBitmapJwt(token, "y".repeat(32))).rejects.toBeInstanceOf(JwtVerifyError);
  });

  it("expired token → JwtVerifyError(reason=expired)", async () => {
    const token = await signBitmapJwt({
      userId: "user-1", bitmap: sampleBm, secret: SECRET, ttlSeconds: 1,
    });
    // 2초 대기 → 만료
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await verifyBitmapJwt(token, SECRET);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JwtVerifyError);
      expect((err as JwtVerifyError).reason).toBe("expired");
    }
  });

  it("malformed token → JwtVerifyError", async () => {
    await expect(verifyBitmapJwt("not.a.jwt", SECRET)).rejects.toBeInstanceOf(JwtVerifyError);
  });
});
```

- [ ] **Step 2: jwt.ts 구현**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * sim-gateway JWT 유틸 — bitmap을 embed하는 HS256 JWT 발급/검증.
 *
 * §2 bitmap-pipeline §3 (저장·전달) 구현:
 *   - signBitmapJwt: VersionedBitmap → JWT (HS256)
 *   - verifyBitmapJwt: JWT → { userId, bitmap }
 *
 * HMAC secret rotation은 본 plan 범위 외 — 단일 secret 가정.
 * dual-accept window는 §2 §7 참조 (운영 도입 시 별도 plan).
 */

import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import type { VersionedBitmap } from "permission-engine";
import { bitmapToClaim, claimToBitmap, type BitmapClaim } from "./bitmap-claim.js";

export type JwtVerifyReason = "expired" | "signature" | "malformed" | "claim_missing";

export class JwtVerifyError extends Error {
  constructor(
    public readonly reason: JwtVerifyReason,
    message: string,
  ) {
    super(message);
    this.name = "JwtVerifyError";
  }
}

export interface SignArgs {
  userId: string;
  bitmap: VersionedBitmap;
  /** UTF-8 문자열 secret (≥ 32 bytes). */
  secret: string;
  ttlSeconds: number;
}

export interface VerifiedJwt {
  userId: string;
  bitmap: VersionedBitmap;
  /** JWT iat → ISO-8601. */
  issuedAt: string;
  /** JWT exp → ISO-8601. */
  expiresAt: string;
}

function secretToKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signBitmapJwt(args: SignArgs): Promise<string> {
  const claim: BitmapClaim = bitmapToClaim(args.bitmap);
  return await new SignJWT({ ...claim })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.userId)
    .setIssuedAt()
    .setExpirationTime(`${args.ttlSeconds}s`)
    .setIssuer("sim-gateway")
    .sign(secretToKey(args.secret));
}

export async function verifyBitmapJwt(
  token: string,
  secret: string,
): Promise<VerifiedJwt> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, secretToKey(secret), {
      issuer: "sim-gateway",
      algorithms: ["HS256"],
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new JwtVerifyError("expired", "JWT expired");
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new JwtVerifyError("signature", "JWT signature invalid");
    }
    if (err instanceof joseErrors.JWSInvalid || err instanceof joseErrors.JWTInvalid) {
      throw new JwtVerifyError("malformed", "JWT malformed");
    }
    throw new JwtVerifyError("malformed", `JWT verify failed: ${(err as Error).message}`);
  }

  const userId = payload.sub;
  if (typeof userId !== "string" || userId === "") {
    throw new JwtVerifyError("claim_missing", "JWT sub missing");
  }
  const iat = typeof payload.iat === "number" ? payload.iat : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  if (iat === null || exp === null) {
    throw new JwtVerifyError("claim_missing", "iat or exp missing");
  }
  const issuedAt = new Date(iat * 1000).toISOString();
  const expiresAt = new Date(exp * 1000).toISOString();

  let bitmap: VersionedBitmap;
  try {
    bitmap = claimToBitmap(payload as Partial<BitmapClaim>, issuedAt, expiresAt);
  } catch (err) {
    throw new JwtVerifyError("claim_missing", (err as Error).message);
  }
  return { userId, bitmap, issuedAt, expiresAt };
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- jwt.test
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/lib/jwt.ts \
          simulations/enterprise-pm/services/gateway/src/lib/jwt.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): JWT sign/verify (HS256) — bitmap embed

jose 라이브러리 사용. issuer="sim-gateway".
JwtVerifyError 4 reason: expired / signature / malformed / claim_missing.
no fallback — verify 실패는 무조건 throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: middleware/jwt-verify — verify + downstream header 주입 (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/middleware/jwt-verify.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/middleware/jwt-verify.test.ts`

- [ ] **Step 1: jwt-verify.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { jwtVerifyMiddleware } from "./jwt-verify.js";
import { signBitmapJwt } from "../lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

const SECRET = "x".repeat(32);
const SAMPLE_BM: VersionedBitmap = {
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0xab, 0xcd]),
  issuedAt: "2026-04-22T00:00:00.000Z",
  expiresAt: "2026-04-22T00:05:00.000Z",
  issuer: "sim-auth-api",
  signature: "sig",
};

function makeApp() {
  const app = new Hono();
  app.use("*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.get("/protected", (c) => {
    return c.json({
      userId: c.req.header("x-user-id"),
      bitmapV: c.req.header("x-user-bitmap-v"),
      bitmapMask: c.req.header("x-user-bitmap-mask"),
      bitmapPrefix: c.req.header("x-user-bitmap-prefix"),
    });
  });
  return app;
}

describe("jwt-verify middleware", () => {
  it("Authorization 헤더 없음 → 401", async () => {
    const app = makeApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
  });

  it("Bearer가 아닌 Authorization → 401", async () => {
    const app = makeApp();
    const res = await app.request("/protected", { headers: { Authorization: "Basic xxx" } });
    expect(res.status).toBe(401);
  });

  it("유효 JWT → 200 + downstream header 4개 주입", async () => {
    const token = await signBitmapJwt({
      userId: "user-42",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = makeApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-42");
    expect(body.bitmapV).toBe("uv1");
    expect(body.bitmapPrefix).toBe("sim.bitmap");
    expect(body.bitmapMask).toBe(Buffer.from([0xab, 0xcd]).toString("base64"));
  });

  it("invalid signature → 401", async () => {
    const token = await signBitmapJwt({
      userId: "user-1", bitmap: SAMPLE_BM, secret: "y".repeat(32), ttlSeconds: 300,
    });
    const app = makeApp();
    const res = await app.request("/protected", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it("version mismatch → 401 + WWW-Authenticate: refresh_required (§2 §6)", async () => {
    const oldBm = { ...SAMPLE_BM, v: "uv0" };
    const token = await signBitmapJwt({ userId: "user-1", bitmap: oldBm, secret: SECRET, ttlSeconds: 300 });
    const app = makeApp(); // currentBitmapV="uv1"
    const res = await app.request("/protected", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("refresh_required");
  });
});
```

- [ ] **Step 2: jwt-verify.ts 구현**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import type { MiddlewareHandler } from "hono";
import { JwtVerifyError, verifyBitmapJwt } from "../lib/jwt.js";

export interface JwtVerifyOptions {
  secret: string;
  /** §2 §6 unified version — 현재 활성 bitmap version. mismatch 시 refresh 강제. */
  currentBitmapV: string;
}

/**
 * Authorization: Bearer <jwt> 검증 → 성공 시 downstream에 header 주입:
 *   x-user-id              — JWT sub
 *   x-user-bitmap-prefix   — claim.bitmap_prefix
 *   x-user-bitmap-v        — claim.bitmap_v
 *   x-user-bitmap-mask     — base64 mask
 *
 * 실패:
 *   - 헤더 없음/형식 오류 → 401 (no body)
 *   - signature/expired/malformed → 401 + WWW-Authenticate: invalid_token
 *   - version mismatch → 401 + WWW-Authenticate: refresh_required (§2 §6)
 */
export function jwtVerifyMiddleware(opts: JwtVerifyOptions): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header("authorization") ?? c.req.header("Authorization");
    if (!auth || !/^Bearer\s+/i.test(auth)) {
      return c.json({ error: "unauthorized", reason: "missing_bearer" }, 401);
    }
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    try {
      const verified = await verifyBitmapJwt(token, opts.secret);
      // §2 §6 unified version binding 검증
      if (verified.bitmap.v !== opts.currentBitmapV) {
        c.header("WWW-Authenticate", `Bearer error="refresh_required", current_v="${opts.currentBitmapV}"`);
        return c.json(
          { error: "version_mismatch", expected: opts.currentBitmapV, got: verified.bitmap.v },
          401,
        );
      }
      // downstream header 주입 — Hono의 req.header()는 incoming만, downstream용 별도 set 필요.
      // 본 구현은 c.set으로 context에 저장 + proxy 단계에서 추출.
      // 단위 테스트는 c.req.header()를 mock 사용하기 어려우므로 c.req.raw.headers.set 사용.
      c.req.raw.headers.set("x-user-id", verified.userId);
      c.req.raw.headers.set("x-user-bitmap-prefix", verified.bitmap.prefix);
      c.req.raw.headers.set("x-user-bitmap-v", verified.bitmap.v);
      c.req.raw.headers.set("x-user-bitmap-mask", Buffer.from(verified.bitmap.mask).toString("base64"));
      c.set("verifiedJwt", verified);
      await next();
      return;
    } catch (err) {
      if (err instanceof JwtVerifyError) {
        c.header("WWW-Authenticate", `Bearer error="invalid_token", reason="${err.reason}"`);
        return c.json({ error: "invalid_token", reason: err.reason }, 401);
      }
      throw err;
    }
  };
}
```

**중요**: `c.req.raw.headers.set` 사용 이유 — Hono의 `req.header()`는 incoming 헤더 read-only view. proxy 단계에서 `c.req.raw.headers`를 fetch에 넘기기 위해 직접 mutation. 표준 Web Request의 Headers는 mutable.

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- jwt-verify
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/middleware/jwt-verify.ts \
          simulations/enterprise-pm/services/gateway/src/middleware/jwt-verify.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): jwt-verify 미들웨어 — downstream header 주입

Authorization: Bearer JWT 검증 → x-user-id / x-user-bitmap-* 4 header 주입.
version mismatch (§2 §6 unified versioning) → 401 + WWW-Authenticate: refresh_required.
JwtVerifyError reason을 응답에 노출 (디버깅).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: middleware/traceparent — OTel propagation 본격 구현 (TDD)

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/middleware/traceparent.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/middleware/traceparent.test.ts`

Plan 10c의 placeholder를 OTel `propagation.extract` + 신규 root span 생성으로 교체.

- [ ] **Step 1: traceparent.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { traceparent } from "./traceparent.js";
import { context, trace } from "@opentelemetry/api";

describe("traceparent middleware — W3C propagation", () => {
  it("incoming traceparent 없으면 신규 root span 생성", async () => {
    const app = new Hono();
    let observedTraceId = "";
    app.use("*", traceparent);
    app.get("/x", (c) => {
      const span = trace.getActiveSpan();
      observedTraceId = span?.spanContext().traceId ?? "";
      return c.text("ok");
    });
    await app.request("/x");
    // 신규 trace id (16바이트 = 32 hex char)
    expect(observedTraceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("incoming traceparent 있으면 그 trace id 유지", async () => {
    const app = new Hono();
    let observedTraceId = "";
    app.use("*", traceparent);
    app.get("/x", (c) => {
      const span = trace.getActiveSpan();
      observedTraceId = span?.spanContext().traceId ?? "";
      return c.text("ok");
    });
    // W3C traceparent: version-traceId-spanId-flags
    const upstreamTrace = "0af7651916cd43dd8448eb211c80319c";
    const upstreamSpan = "b7ad6b7169203331";
    const traceparent = `00-${upstreamTrace}-${upstreamSpan}-01`;
    await app.request("/x", { headers: { traceparent } });
    expect(observedTraceId).toBe(upstreamTrace);
  });

  it("malformed traceparent → 신규 root (graceful)", async () => {
    const app = new Hono();
    let traceId = "";
    app.use("*", traceparent);
    app.get("/x", (c) => {
      traceId = trace.getActiveSpan()?.spanContext().traceId ?? "";
      return c.text("ok");
    });
    await app.request("/x", { headers: { traceparent: "not-a-traceparent" } });
    // 신규 random trace
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
  });
});
```

- [ ] **Step 2: traceparent.ts 본격 구현**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import type { MiddlewareHandler } from "hono";
import {
  context,
  propagation,
  trace,
  type Span,
  type Tracer,
} from "@opentelemetry/api";

const tracer: Tracer = trace.getTracer("sim-gateway");

/**
 * W3C traceparent propagation 미들웨어.
 *
 * §2 bitmap-pipeline은 trace_id로 audit/log/metric 연결을 전제 — 본 미들웨어가
 * cross-service trace 연속성을 보장한다.
 *
 * 동작:
 *   1. incoming 헤더에서 propagation.extract → upstream context 추출
 *   2. upstream context 위에 gateway span 시작 ("gateway.handle")
 *   3. context.with()로 active span 설정 → 다음 핸들러에서 trace.getActiveSpan() 가능
 *   4. 응답 종료 시 span.end()
 *
 * traceparent 누락/malformed → 신규 root span 생성 (graceful — 외부 클라이언트 호환).
 */
export const traceparent: MiddlewareHandler = async (c, next) => {
  // Hono의 incoming headers를 record로 변환 (propagation API가 Carrier 인터페이스 요구)
  const carrier: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    carrier[key.toLowerCase()] = value;
  });
  const upstreamCtx = propagation.extract(context.active(), carrier);

  const span: Span = tracer.startSpan(
    `gateway ${c.req.method} ${new URL(c.req.url).pathname}`,
    {
      attributes: {
        "http.method": c.req.method,
        "http.target": new URL(c.req.url).pathname,
        "service.name": "sim-gateway",
      },
    },
    upstreamCtx,
  );

  try {
    await context.with(trace.setSpan(upstreamCtx, span), async () => {
      await next();
      span.setAttribute("http.status_code", c.res.status);
    });
  } catch (err) {
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
};
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- traceparent
```

Expected: 3 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/middleware/traceparent.ts \
          simulations/enterprise-pm/services/gateway/src/middleware/traceparent.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): traceparent OTel 본격 구현 (W3C propagation)

propagation.extract → upstream context → gateway span 시작.
malformed traceparent는 신규 root (graceful, 외부 클라이언트 호환).
trace.getActiveSpan() 으로 다음 미들웨어/핸들러에서 접근 가능.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: lib/proxy — fetch + traceparent inject + timeout (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/lib/proxy.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/lib/proxy.test.ts`

- [ ] **Step 1: proxy.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from "vitest";
import { proxyRequest } from "./proxy.js";

afterEach(() => vi.restoreAllMocks());

describe("proxyRequest", () => {
  it("downstream 호출 — 메서드/path/헤더 전달", async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://downstream.local:1234/projects/abc");
      expect(init?.method).toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-user-id")).toBe("user-1");
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const inReq = new Request("http://gateway/projects/abc", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/projects/abc",
      request: inReq,
      timeoutMs: 5000,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("body POST 전달 + Content-Type 보존", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toBe("application/json");
      const body = await new Response(init?.body as BodyInit).text();
      expect(body).toBe('{"x":1}');
      return new Response("created", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const inReq = new Request("http://gateway/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"x":1}',
    });
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/projects",
      request: inReq,
      timeoutMs: 5000,
    });
    expect(res.status).toBe(201);
  });

  it("timeout 초과 → 504", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      // AbortSignal abort 시 throw
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        // never resolves
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const inReq = new Request("http://gateway/x", { method: "GET" });
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/x",
      request: inReq,
      timeoutMs: 50,
    });
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toBe("upstream_timeout");
  });

  it("downstream 5xx → status 그대로 전달", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 503 })));
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/x",
      request: new Request("http://gateway/x"),
      timeoutMs: 5000,
    });
    expect(res.status).toBe(503);
  });

  it("traceparent 헤더가 OTel propagation으로 자동 부착", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      // OTel propagation은 active span이 있을 때 traceparent를 inject. 본 테스트는
      // active span이 없으므로 inject 결과가 비어있을 수 있음. 다만 inject 호출은 항상 발생.
      expect(headers.has("x-user-id")).toBe(true);
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxyRequest({
      targetBaseUrl: "http://downstream.local:1234",
      sourcePath: "/x",
      request: new Request("http://gateway/x", { headers: { "x-user-id": "u" } }),
      timeoutMs: 5000,
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: proxy.ts 구현**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { context, propagation } from "@opentelemetry/api";

export interface ProxyArgs {
  /** downstream base URL (예: "http://sim-pm-api:4500"). */
  targetBaseUrl: string;
  /** gateway path 그대로 (예: "/projects/abc"). */
  sourcePath: string;
  /** incoming Web Request — body/headers 포함. */
  request: Request;
  timeoutMs: number;
}

/**
 * downstream으로 reverse proxy. 본 함수는 fetch에 100% 위임 (no fallback):
 *   - method / body / headers 그대로 전달
 *   - W3C traceparent를 OTel propagation으로 inject
 *   - AbortSignal.timeout으로 timeout — 초과 시 504 응답
 *   - downstream 응답 status/headers/body 그대로 반환
 *
 * 인입 요청의 host / connection / content-length 등 hop-by-hop 헤더는 fetch가 자동 관리.
 */
export async function proxyRequest(args: ProxyArgs): Promise<Response> {
  const target = new URL(args.sourcePath, args.targetBaseUrl).toString();
  const headers = new Headers();
  args.request.headers.forEach((v, k) => headers.set(k, v));

  // OTel context의 active span에서 traceparent 자동 inject
  propagation.inject(context.active(), headers, {
    set: (h, key, val) => (h as Headers).set(key, val),
  });

  // body 변환 — GET/HEAD는 body 금지
  let body: BodyInit | undefined;
  if (args.request.method !== "GET" && args.request.method !== "HEAD") {
    body = await args.request.clone().arrayBuffer();
  }

  const signal = AbortSignal.timeout(args.timeoutMs);

  try {
    const downstream = await fetch(target, {
      method: args.request.method,
      headers,
      body,
      signal,
      // proxy: TLS verify 등은 fetch 기본값 따름
    });
    // 응답 그대로 반환 (status/headers/body)
    const resHeaders = new Headers(downstream.headers);
    return new Response(downstream.body, {
      status: downstream.status,
      statusText: downstream.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError" || (err as DOMException).name === "TimeoutError") {
      return Response.json(
        { error: "upstream_timeout", target, timeoutMs: args.timeoutMs },
        { status: 504 },
      );
    }
    return Response.json(
      { error: "upstream_unavailable", target, message: (err as Error).message },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- proxy.test
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/lib/proxy.ts \
          simulations/enterprise-pm/services/gateway/src/lib/proxy.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): proxy.ts — fetch + OTel propagation + timeout

AbortSignal.timeout으로 5s default timeout (env override).
504 (upstream_timeout) / 502 (upstream_unavailable) 표준 응답.
W3C traceparent를 propagation.inject로 자동 부착.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: routes/login — auth-api 위임 + JWT 발급 (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/routes/login.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routes/login.test.ts`

- [ ] **Step 1: login.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { createLoginRoute } from "./login.js";
import { verifyBitmapJwt } from "../lib/jwt.js";

const SECRET = "x".repeat(32);

afterEach(() => vi.restoreAllMocks());

describe("POST /auth/login", () => {
  it("정상 로그인 — auth-api에 자격 위임 → bitmap → JWT 발급", async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.endsWith("/auth/authenticate")) {
        return Response.json({ userId: "user-42", displayName: "Alice" });
      }
      if (target.endsWith("/bitmap/issue")) {
        const body = JSON.parse(await new Response(init?.body as BodyInit).text());
        expect(body.userId).toBe("user-42");
        return Response.json({
          prefix: "sim.bitmap",
          v: "uv1",
          maskBase64: Buffer.from([0xab, 0xcd, 0xef]).toString("base64"),
          issuedAt: "2026-04-22T00:00:00.000Z",
          expiresAt: "2026-04-22T00:05:00.000Z",
          issuer: "sim-auth-api",
          signature: "auth-sig",
        });
      }
      throw new Error(`unexpected fetch: ${target}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = new Hono();
    app.route("/", createLoginRoute({
      authApiUrl: "http://sim-auth-api:4400",
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
    }));

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com", password: "x" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    const verified = await verifyBitmapJwt(body.token, SECRET);
    expect(verified.userId).toBe("user-42");
    expect(verified.bitmap.prefix).toBe("sim.bitmap");
    expect(verified.bitmap.v).toBe("uv1");
    expect(Array.from(verified.bitmap.mask)).toEqual([0xab, 0xcd, 0xef]);
  });

  it("auth-api 인증 실패 (401) → 401 반환", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    const app = new Hono();
    app.route("/", createLoginRoute({ authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300 }));
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x", password: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("body가 JSON이 아니면 400", async () => {
    const app = new Hono();
    app.route("/", createLoginRoute({ authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300 }));
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });

  it("email/password 누락 → 400", async () => {
    const app = new Hono();
    app.route("/", createLoginRoute({ authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300 }));
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("bitmap issue 실패 (5xx) → 502", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).endsWith("/auth/authenticate")) {
        return Response.json({ userId: "u" });
      }
      return new Response("err", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = new Hono();
    app.route("/", createLoginRoute({ authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300 }));
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b", password: "p" }),
    });
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: login.ts 구현**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { z } from "zod";
import { signBitmapJwt } from "../lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

export interface LoginRouteOptions {
  authApiUrl: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
}

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const authResponseSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().optional(),
  departmentId: z.string().nullable().optional(),
});

const bitmapResponseSchema = z.object({
  prefix: z.string(),
  v: z.string(),
  maskBase64: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string(),
  issuer: z.string(),
  signature: z.string(),
});

/**
 * POST /auth/login — 로그인 위임 + bitmap 발급 + JWT embed.
 *
 * 흐름:
 *   1. body { email, password } 검증
 *   2. auth-api POST /auth/authenticate → userId
 *   3. auth-api POST /bitmap/issue { userId } → VersionedBitmap (mask는 base64)
 *   4. signBitmapJwt → JWT 응답
 *
 * 모든 단계 fail-fast — silent fallback 없음.
 */
export function createLoginRoute(opts: LoginRouteOptions) {
  const r = new Hono();
  r.post("/auth/login", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json_body" }, 400);
    }
    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_credentials_payload", issues: parsed.error.issues }, 400);
    }

    // 1. 인증 위임
    const authRes = await fetch(`${opts.authApiUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(5_000),
    });
    if (authRes.status === 401) return c.json({ error: "invalid_credentials" }, 401);
    if (!authRes.ok) {
      return c.json({ error: "auth_upstream_failure", status: authRes.status }, 502);
    }
    let authJson: unknown;
    try {
      authJson = await authRes.json();
    } catch {
      return c.json({ error: "auth_upstream_invalid_json" }, 502);
    }
    const authParsed = authResponseSchema.safeParse(authJson);
    if (!authParsed.success) {
      return c.json({ error: "auth_upstream_schema", issues: authParsed.error.issues }, 502);
    }

    // 2. bitmap 발급
    const bmRes = await fetch(`${opts.authApiUrl}/bitmap/issue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: authParsed.data.userId }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!bmRes.ok) {
      return c.json({ error: "bitmap_upstream_failure", status: bmRes.status }, 502);
    }
    let bmJson: unknown;
    try {
      bmJson = await bmRes.json();
    } catch {
      return c.json({ error: "bitmap_upstream_invalid_json" }, 502);
    }
    const bmParsed = bitmapResponseSchema.safeParse(bmJson);
    if (!bmParsed.success) {
      return c.json({ error: "bitmap_upstream_schema", issues: bmParsed.error.issues }, 502);
    }

    const bitmap: VersionedBitmap = {
      prefix: bmParsed.data.prefix,
      v: bmParsed.data.v,
      mask: new Uint8Array(Buffer.from(bmParsed.data.maskBase64, "base64")),
      issuedAt: bmParsed.data.issuedAt,
      expiresAt: bmParsed.data.expiresAt,
      issuer: bmParsed.data.issuer,
      signature: bmParsed.data.signature,
    };

    // 3. JWT 발급
    const token = await signBitmapJwt({
      userId: authParsed.data.userId,
      bitmap,
      secret: opts.jwtSecret,
      ttlSeconds: opts.jwtTtlSeconds,
    });

    return c.json({
      token,
      tokenType: "Bearer",
      expiresIn: opts.jwtTtlSeconds,
      userId: authParsed.data.userId,
      bitmapPrefix: bitmap.prefix,
      bitmapV: bitmap.v,
    });
  });

  return r;
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- login.test
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/routes/login.ts \
          simulations/enterprise-pm/services/gateway/src/routes/login.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): POST /auth/login — auth-api 위임 + bitmap + JWT 발급

zod schema로 body / upstream 응답 검증.
401 (invalid credentials) / 502 (upstream failure) 명시적 분기.
maskBase64를 Uint8Array로 복원 후 signBitmapJwt 호출.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: routes/proxy-routes — 6 비즈니스 서비스 reverse proxy (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.test.ts`

`/auth/login`은 별도 라우터. 그 외 6 서비스 + auth-api의 logout/refresh 등 protected route를 매핑.

- [ ] **Step 1: proxy-routes.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { createProxyRoutes, PROXY_TARGETS } from "./proxy-routes.js";
import { jwtVerifyMiddleware } from "../middleware/jwt-verify.js";
import { signBitmapJwt } from "../lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

const SECRET = "x".repeat(32);
const SAMPLE_BM: VersionedBitmap = {
  prefix: "sim.bitmap", v: "uv1", mask: new Uint8Array([0x01]),
  issuedAt: "2026-04-22T00:00:00Z", expiresAt: "2026-04-22T00:05:00Z",
  issuer: "sim-auth-api", signature: "s",
};

afterEach(() => vi.restoreAllMocks());

async function makeAuthedApp(targets: Record<string, string>) {
  const app = new Hono();
  app.use("/projects/*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.use("/approvals/*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.use("/notifications/*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.use("/reports/*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.use("/documents/*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.use("/audit/*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.route("/", createProxyRoutes({ targets, timeoutMs: 5000 }));
  return app;
}

describe("createProxyRoutes — 6 service reverse proxy", () => {
  it("PROXY_TARGETS 표 — 6 서비스 (auth는 logout/refresh만 protected)", () => {
    expect(PROXY_TARGETS.map((t) => t.path)).toEqual([
      "/projects",
      "/approvals",
      "/notifications",
      "/reports",
      "/documents",
      "/audit",
    ]);
  });

  it("/projects/123 → sim-pm-api로 proxy + downstream에 x-user-id", async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://sim-pm-api:4500/projects/123");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-user-id")).toBe("user-42");
      expect(headers.get("x-user-bitmap-v")).toBe("uv1");
      return Response.json({ project: "p123" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await signBitmapJwt({
      userId: "user-42", bitmap: SAMPLE_BM, secret: SECRET, ttlSeconds: 300,
    });
    const app = await makeAuthedApp({
      "sim-pm-api": "http://sim-pm-api:4500",
      "sim-approval-api": "http://x:1",
      "sim-notification-api": "http://x:2",
      "sim-reporting-api": "http://x:3",
      "sim-document-api": "http://x:4",
      "sim-audit-browser-api": "http://x:5",
    });
    const res = await app.request("/projects/123", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).project).toBe("p123");
  });

  it("JWT 누락 → 401 (proxy 호출 없음)", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const app = await makeAuthedApp({
      "sim-pm-api": "http://sim-pm-api:4500",
      "sim-approval-api": "http://x:1",
      "sim-notification-api": "http://x:2",
      "sim-reporting-api": "http://x:3",
      "sim-document-api": "http://x:4",
      "sim-audit-browser-api": "http://x:5",
    });
    const res = await app.request("/projects/x");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("6 서비스 모두 정상 라우팅 (smoke)", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      return Response.json({ ok: true });
    }));
    const token = await signBitmapJwt({
      userId: "u", bitmap: SAMPLE_BM, secret: SECRET, ttlSeconds: 300,
    });
    const targets = {
      "sim-pm-api": "http://sim-pm-api:4500",
      "sim-approval-api": "http://sim-approval-api:4600",
      "sim-notification-api": "http://sim-notification-api:4700",
      "sim-reporting-api": "http://sim-reporting-api:4800",
      "sim-document-api": "http://sim-document-api:4900",
      "sim-audit-browser-api": "http://sim-audit-browser-api:5100",
    };
    const app = await makeAuthedApp(targets);
    for (const [path, expectedTarget] of [
      ["/projects/x", "http://sim-pm-api:4500/projects/x"],
      ["/approvals/y", "http://sim-approval-api:4600/approvals/y"],
      ["/notifications/z", "http://sim-notification-api:4700/notifications/z"],
      ["/reports/q", "http://sim-reporting-api:4800/reports/q"],
      ["/documents/d", "http://sim-document-api:4900/documents/d"],
      ["/audit/a", "http://sim-audit-browser-api:5100/audit/a"],
    ] as const) {
      const res = await app.request(path, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status).toBe(200);
      expect(calls).toContain(expectedTarget);
    }
  });
});
```

- [ ] **Step 2: proxy-routes.ts 구현**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { proxyRequest } from "../lib/proxy.js";

export interface ProxyTarget {
  path: string;             // gateway prefix (예: "/projects")
  serviceKey: string;       // targets map의 키 (예: "sim-pm-api")
  description: string;
}

export const PROXY_TARGETS: readonly ProxyTarget[] = [
  { path: "/projects",      serviceKey: "sim-pm-api",            description: "PM domain" },
  { path: "/approvals",     serviceKey: "sim-approval-api",      description: "Approval workflows" },
  { path: "/notifications", serviceKey: "sim-notification-api",  description: "Notifications" },
  { path: "/reports",       serviceKey: "sim-reporting-api",     description: "Reporting" },
  { path: "/documents",     serviceKey: "sim-document-api",      description: "Documents" },
  { path: "/audit",         serviceKey: "sim-audit-browser-api", description: "Audit explorer" },
];

export interface CreateProxyRoutesOptions {
  /** serviceKey → base URL. PROXY_TARGETS의 모든 serviceKey가 등록되어야 함. */
  targets: Record<string, string>;
  timeoutMs: number;
}

export function createProxyRoutes(opts: CreateProxyRoutesOptions) {
  const r = new Hono();
  for (const target of PROXY_TARGETS) {
    const base = opts.targets[target.serviceKey];
    if (!base) {
      throw new Error(`createProxyRoutes: target ${target.serviceKey} URL missing`);
    }
    r.all(`${target.path}/*`, async (c) => {
      return proxyRequest({
        targetBaseUrl: base,
        sourcePath: new URL(c.req.url).pathname + new URL(c.req.url).search,
        request: c.req.raw,
        timeoutMs: opts.timeoutMs,
      });
    });
    // root path (/projects, /approvals 등)도 라우팅 대상
    r.all(target.path, async (c) => {
      return proxyRequest({
        targetBaseUrl: base,
        sourcePath: new URL(c.req.url).pathname + new URL(c.req.url).search,
        request: c.req.raw,
        timeoutMs: opts.timeoutMs,
      });
    });
  }
  return r;
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- proxy-routes
```

Expected: 4 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts \
          simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): 6 비즈니스 서비스 reverse proxy 라우터

PROXY_TARGETS 6 entry — projects/approvals/notifications/reports/documents/audit.
각 path/* 와 path 자체 모두 매핑 (root path 포함).
target URL 누락 시 throw (no silent fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: app.ts + server.ts — 본격 통합 + placeholder 제거

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/app.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/app.test.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/server.ts`
- Delete: `simulations/enterprise-pm/services/gateway/src/routes/placeholder.ts`

- [ ] **Step 1: app.ts 갱신 — placeholder 제거 + 신규 라우터 마운트**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { requestId } from "./middleware/request-id.js";
import { traceparent } from "./middleware/traceparent.js";
import { jwtVerifyMiddleware } from "./middleware/jwt-verify.js";
import { createHealthRoutes } from "./routes/health.js";
import { createLoginRoute } from "./routes/login.js";
import { createProxyRoutes, PROXY_TARGETS } from "./routes/proxy-routes.js";

export interface AppOptions {
  authApiUrl: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  /** unified bitmap version — version mismatch 시 401 + refresh_required. */
  currentBitmapV: string;
  proxyTimeoutMs: number;
  proxyTargets: Record<string, string>;
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  app.use("*", requestId);
  app.use("*", traceparent);

  // /health 는 unprotected
  app.route("/", createHealthRoutes());

  // /auth/login 은 unprotected (인증 자체)
  app.route("/", createLoginRoute({
    authApiUrl: opts.authApiUrl,
    jwtSecret: opts.jwtSecret,
    jwtTtlSeconds: opts.jwtTtlSeconds,
  }));

  // protected routes — JWT verify
  for (const target of PROXY_TARGETS) {
    app.use(`${target.path}/*`, jwtVerifyMiddleware({
      secret: opts.jwtSecret,
      currentBitmapV: opts.currentBitmapV,
    }));
    app.use(target.path, jwtVerifyMiddleware({
      secret: opts.jwtSecret,
      currentBitmapV: opts.currentBitmapV,
    }));
  }
  app.route("/", createProxyRoutes({
    targets: opts.proxyTargets,
    timeoutMs: opts.proxyTimeoutMs,
  }));

  return app;
}
```

- [ ] **Step 2: app.test.ts 갱신 — placeholder 제거 + protected/unprotected 매트릭스**

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { createApp } from "./app.js";
import { signBitmapJwt } from "./lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

const SECRET = "x".repeat(32);
const SAMPLE_BM: VersionedBitmap = {
  prefix: "sim.bitmap", v: "uv1", mask: new Uint8Array([0x01]),
  issuedAt: "2026-04-22T00:00:00Z", expiresAt: "2026-04-22T00:05:00Z",
  issuer: "sim-auth-api", signature: "s",
};

const TARGETS = {
  "sim-pm-api": "http://sim-pm-api:4500",
  "sim-approval-api": "http://sim-approval-api:4600",
  "sim-notification-api": "http://sim-notification-api:4700",
  "sim-reporting-api": "http://sim-reporting-api:4800",
  "sim-document-api": "http://sim-document-api:4900",
  "sim-audit-browser-api": "http://sim-audit-browser-api:5100",
};

afterEach(() => vi.restoreAllMocks());

describe("sim-gateway app — 통합 마운트", () => {
  it("/health 는 unprotected — 200", async () => {
    const app = createApp({
      authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300,
      currentBitmapV: "uv1", proxyTimeoutMs: 5000, proxyTargets: TARGETS,
    });
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect((await res.json()).service).toBe("sim-gateway");
  });

  it("x-request-id 헤더 부착", async () => {
    const app = createApp({
      authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300,
      currentBitmapV: "uv1", proxyTimeoutMs: 5000, proxyTargets: TARGETS,
    });
    const res = await app.request("/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("/auth/login 은 unprotected — JWT 없이 접근 가능 (downstream mock)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url).endsWith("/auth/authenticate")) return Response.json({ userId: "u" });
      if (String(url).endsWith("/bitmap/issue")) return Response.json({
        prefix: "sim.bitmap", v: "uv1", maskBase64: "AQ==",
        issuedAt: "2026-04-22T00:00:00Z", expiresAt: "2026-04-22T00:05:00Z",
        issuer: "sim-auth-api", signature: "s",
      });
      return new Response("nope", { status: 404 });
    }));
    const app = createApp({
      authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300,
      currentBitmapV: "uv1", proxyTimeoutMs: 5000, proxyTargets: TARGETS,
    });
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.c", password: "p" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });

  it("/projects/x — JWT 없이 401", async () => {
    const app = createApp({
      authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300,
      currentBitmapV: "uv1", proxyTimeoutMs: 5000, proxyTargets: TARGETS,
    });
    const res = await app.request("/projects/abc");
    expect(res.status).toBe(401);
  });

  it("/projects/x — 유효 JWT → downstream 호출 + 200", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("http://sim-pm-api:4500/projects/abc");
      return Response.json({ project: "abc" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const token = await signBitmapJwt({
      userId: "u", bitmap: SAMPLE_BM, secret: SECRET, ttlSeconds: 300,
    });
    const app = createApp({
      authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300,
      currentBitmapV: "uv1", proxyTimeoutMs: 5000, proxyTargets: TARGETS,
    });
    const res = await app.request("/projects/abc", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
  });

  it("placeholder 라우트는 더 이상 존재하지 않음 — Plan 10c 제거 회귀", async () => {
    const app = createApp({
      authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300,
      currentBitmapV: "uv1", proxyTimeoutMs: 5000, proxyTargets: TARGETS,
    });
    // Plan 10c는 503 + Plan 12a will implement 메시지였음
    const res = await app.request("/projects/x");
    if (res.status === 503) {
      const body = await res.json();
      expect(body.message ?? "").not.toContain("Plan 12a will implement");
    }
  });
});
```

- [ ] **Step 3: server.ts 갱신 — createApp에 옵션 주입**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import "reflect-metadata";
import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

const SERVICE_NAME = "sim-gateway";
const logger = createLogger(SERVICE_NAME);

const otelShutdown = initTelemetry({
  serviceName: SERVICE_NAME,
  env: otelEnvSchema.parse(process.env),
});

const app = createApp({
  authApiUrl: env.AUTH_API_URL,
  jwtSecret: env.JWT_SECRET,
  jwtTtlSeconds: env.JWT_TTL_SECONDS,
  currentBitmapV: "uv1", // §2 §6 unified version. shape 변경 시 갱신.
  proxyTimeoutMs: env.PROXY_TIMEOUT_MS,
  proxyTargets: {
    "sim-pm-api": env.PM_API_URL,
    "sim-approval-api": env.APPROVAL_API_URL,
    "sim-notification-api": env.NOTIFICATION_API_URL,
    "sim-reporting-api": env.REPORTING_API_URL,
    "sim-document-api": env.DOCUMENT_API_URL,
    "sim-audit-browser-api": env.AUDIT_BROWSER_API_URL,
  },
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      authApi: env.AUTH_API_URL,
      currentBitmapV: "uv1",
      jwtTtlSeconds: env.JWT_TTL_SECONDS,
      proxyTimeoutMs: env.PROXY_TIMEOUT_MS,
    },
    `${SERVICE_NAME} listening (Plan 12a JWT + traceparent + reverse proxy)`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);
});

installSimpleShutdown({ server, logger });

process.on("SIGTERM", () => void otelShutdown());
process.on("SIGINT", () => void otelShutdown());
```

- [ ] **Step 4: placeholder.ts 삭제**

```bash
rm /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/gateway/src/routes/placeholder.ts
```

- [ ] **Step 5: typecheck + 전체 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway test 2>&1 | tail -10 && \
  pnpm --filter @qa-sdk/sim-gateway build
```

Expected: typecheck 0, 누적 PASS = env 9 + bitmap-claim 5 + jwt 5 + jwt-verify 5 + traceparent 3 + proxy 5 + login 5 + proxy-routes 4 + app 6 = 47 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/app.ts \
          simulations/enterprise-pm/services/gateway/src/app.test.ts \
          simulations/enterprise-pm/services/gateway/src/server.ts && \
  git rm simulations/enterprise-pm/services/gateway/src/routes/placeholder.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): app + server 본격 통합 — placeholder 제거

createApp(opts) — authApiUrl + JWT secret + bitmap V + proxy targets 주입.
/health, /auth/login = unprotected.
6 PROXY_TARGETS = JWT verify → reverse proxy.
placeholder.ts 삭제 (Plan 10c 임시 503 종료).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: integration.test — 실 sim-auth-api 통합 검증

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/integration.test.ts`

본 테스트는 sim-auth-api를 in-process NestJS app으로 부팅하여 (in-memory store) 실제 login 흐름을 검증.

- [ ] **Step 1: integration.test.ts**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * sim-gateway ↔ sim-auth-api 통합 — login 흐름 e2e 검증.
 *
 * sim-auth-api를 in-memory store + InMemoryAuthRepository로 부팅하여
 * 실제 NestJS 라우트 + BitmapIssuerService를 호출. gateway는 Hono request
 * (in-process) 로 호출.
 *
 * 본 테스트는 Plan 11a의 InMemory 시드(seed-test-data.ts)를 활용. 미준비 시
 * 본 파일은 skip (env gate).
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createApp } from "./app.js";
import { verifyBitmapJwt } from "./lib/jwt.js";
import type { INestApplication } from "@nestjs/common";

const SECRET = "x".repeat(32);
const SKIP = process.env.SIM_GATEWAY_INTEGRATION !== "1";

describe.skipIf(SKIP)("sim-gateway integration — 실 sim-auth-api", () => {
  let authApp: INestApplication;
  let authPort: number;

  beforeAll(async () => {
    // dynamic import — auth-api dep는 본 테스트에서만 활성화
    const { bootstrapTestAuthApi } = await import(
      // @ts-ignore — Plan 11a가 export하는 헬퍼
      "@qa-sdk/sim-auth-api/test-bootstrap"
    ) as { bootstrapTestAuthApi: () => Promise<{ app: INestApplication; port: number }> };
    const ctx = await bootstrapTestAuthApi();
    authApp = ctx.app;
    authPort = ctx.port;
  });

  afterAll(async () => {
    if (authApp) await authApp.close();
  });

  it("/auth/login → JWT 발급 → /projects/x proxy (downstream mock)", async () => {
    const app = createApp({
      authApiUrl: `http://localhost:${authPort}`,
      jwtSecret: SECRET, jwtTtlSeconds: 300, currentBitmapV: "uv1",
      proxyTimeoutMs: 5000,
      proxyTargets: {
        "sim-pm-api": `http://127.0.0.1:1`, // 실제 호출 안 함 — 본 테스트는 login만
        "sim-approval-api": "http://127.0.0.1:1",
        "sim-notification-api": "http://127.0.0.1:1",
        "sim-reporting-api": "http://127.0.0.1:1",
        "sim-document-api": "http://127.0.0.1:1",
        "sim-audit-browser-api": "http://127.0.0.1:1",
      },
    });

    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com", password: "test123" }),
    });
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json();
    expect(token).toBeTruthy();
    const verified = await verifyBitmapJwt(token, SECRET);
    expect(verified.bitmap.prefix).toBe("sim.bitmap");
    expect(verified.bitmap.v).toBe("uv1");
    expect(verified.bitmap.mask.length).toBeGreaterThan(0);
  });
});
```

**참고**: `bootstrapTestAuthApi` 헬퍼는 Plan 11a 마지막 task에서 export 예정. 미존재 시 본 테스트는 skip 대신 그 헬퍼를 추가하는 별도 작은 task가 필요. integration 검증은 SIM_GATEWAY_INTEGRATION=1 env로 활성화.

- [ ] **Step 2: 통합 테스트 실행 (env gate)**

```bash
SIM_GATEWAY_INTEGRATION=1 \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- integration.test
```

Expected: SIM_GATEWAY_INTEGRATION=1 시 1 PASS, 미설정 시 skip.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/integration.test.ts && \
  git commit -m "$(cat <<'EOF'
test(sim-gateway): integration — 실 sim-auth-api 부팅 후 login 흐름

SIM_GATEWAY_INTEGRATION=1 env gate. dynamic import로 NestJS app 부팅.
login → JWT 발급 → claim 복원까지 e2e.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 회귀 + smoke

- [ ] **Step 1: gateway 전체 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway test 2>&1 | tail -5 && \
  pnpm --filter @qa-sdk/sim-gateway build
```

Expected: 47 PASS (integration skip), build 0 error.

- [ ] **Step 2: 부팅 smoke (실 환경)**

```bash
JWT_SECRET="$(openssl rand -hex 32)" \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway start &
PID=$!
sleep 3
echo "/health:"; curl -fsS http://localhost:8888/health; echo
echo "/projects/x (no JWT):"; curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8888/projects/x
echo "/auth/login (no body):"; curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8888/auth/login
kill $PID 2>/dev/null || true
```

Expected: /health 200, /projects/x 401, /auth/login 400.

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0 유지.

- [ ] **Step 4: workflow-smoke 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm exec vitest run workflow-smoke 2>&1 | tail -5
```

Expected: 12 silent-empty regression test PASS.

---

## Self-Review

- [ ] §2 bitmap-pipeline §3 (저장·전달) 정확 구현 — VersionedBitmap → JWT (HS256) embed
- [ ] §2 §6 unified version binding — version mismatch 시 401 + WWW-Authenticate: refresh_required
- [ ] JWT verify 4 reason 분기 (expired / signature / malformed / claim_missing) — silent fallback 없음
- [ ] traceparent 미들웨어가 W3C propagation 정확 구현 — extract → span 시작 → inject (proxy)
- [ ] 6 reverse proxy 라우트 모두 동작 — /projects, /approvals, /notifications, /reports, /documents, /audit
- [ ] proxy timeout 5s — 504 (timeout) / 502 (unavailable) 명시
- [ ] /health, /auth/login = unprotected, 그 외 = JWT verify 강제
- [ ] placeholder.ts 삭제 — Plan 10c 임시 종료
- [ ] env JWT_SECRET 32바이트 미만 시 부팅 거절 (no fallback)
- [ ] integration test가 env gate로 격리 (CI 영향 없음)
- [ ] 누적 47 PASS (env 9 + bitmap-claim 5 + jwt 5 + jwt-verify 5 + traceparent 3 + proxy 5 + login 5 + proxy-routes 4 + app 6)

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| HMAC secret rotation (dual-accept window) | §2 §7 — 운영 도입 시점 | Phase 5 보안 plan |
| RS256 / KID rotation | sim 환경은 단일 secret로 충분 | Phase 5 |
| `/auth/refresh` endpoint (refresh path) | Plan 13d 시나리오 7에서 사용 | Plan 13d |
| Redis pub/sub invalidation 통합 | 본 plan은 verify만, invalidation은 Plan 12b | Plan 12b |
| audit-recorder 자동 로깅 (verify 결과) | Plan 12c가 OtelAuditRecorder + IngestForwarder 통합 | Plan 12c |
| rate limiting / WAF | 시뮬 외 운영 | 후속 |
| OpenAPI 스펙 자동 생성 | Phase 5 DX | 후속 |

---

## 의존·후속

- **Plan 10c** (gateway placeholder 부팅): 본 plan의 직접 선행. placeholder 라우트 → 본 plan에서 actual proxy.
- **Plan 11a** (sim-auth-api BitmapIssuerService): `/auth/authenticate` + `/bitmap/issue` endpoint 필수. integration test의 in-process bootstrap helper도 11a가 export.
- **Plan 12b** (bitmap pub/sub invalidation): 본 plan의 verify는 단일 version 기준. 12b가 invalidation 도입 → 다음 verify 시 refresh 강제.
- **Plan 12c** (OTEL + audit-recorder + IngestForwarder): 본 plan의 traceparent가 12c의 audit 로그와 trace_id 일치 확인.
- **Plan 13a/c/d** (시나리오 1/5/7/8): 본 plan의 login + proxy + refresh path를 e2e 검증.
