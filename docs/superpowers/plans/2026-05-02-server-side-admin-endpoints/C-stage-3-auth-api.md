# Stage 3 — Auth-API Bitmap Version Admin Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** auth-api에 admin endpoint 2종 추가: `POST /admin/bitmap/bump-version` (시나리오 16에서 prefix version 강제 bump) + `GET /admin/bitmap/version` (현재 prefix version 조회).

**Architecture:** auth-api 안에 BitmapVersionService 신설. 시뮬용 monotonic counter로 prefix version state(stable/retired) 관리. AdminBitmapVersionController가 service 호출 + InternalIpGuard 부착.

**Tech Stack:** TypeScript ES2023, NestJS 11 + Fastify, vitest, sim-identifier-grammar (VersionTag #2), sim-internal-network (Stage 1a NestJS Guard).

**Spec 인용:** `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §9 Stage 3.

### File Structure

| 종류 | 경로 (root: `simulations/enterprise-pm/`) |
|---|---|
| Create | `services/auth-api/src/auth/bitmap-version/bitmap-version.service.ts` (+ `.test.ts`) |
| Create | `services/auth-api/src/auth/bitmap-version/admin-bitmap-version.controller.ts` (+ `.test.ts`) |
| Create | `services/auth-api/src/auth/bitmap-version/bitmap-version.module.ts` |
| Create | `services/auth-api/src/auth/bitmap-version/contract.test.ts` |
| Modify | `services/auth-api/src/app.module.ts` (BitmapVersionModule import) |
| Modify | `services/auth-api/package.json` (sim-internal-network · sim-identifier-grammar 의존) |

---

### Task 3.1: BitmapVersionService — monotonic counter

**Files:** Create `bitmap-version.service.ts` (+ `.test.ts`)

spec §9: *"prefix version state를 stable → retired + 새 stable 추가. 시뮬용 monotonic counter 증가."* in-memory `Map<prefix, { current, retired[] }>`로 구현 (production catalog API와 분리).

- [ ] **Step 3.1.1: 실패 테스트 작성**

`bitmap-version.service.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { parseVersionTag } from "sim-identifier-grammar";
import { BitmapVersionService } from "./bitmap-version.service.js";

describe("BitmapVersionService (spec §9 Stage 3)", () => {
  let svc: BitmapVersionService;
  beforeEach(() => { svc = new BitmapVersionService(); });

  it("초기 sim.bitmap stable=v1", () => {
    expect(parseVersionTag(svc.getCurrent("sim.bitmap")))
      .toEqual({ axis: "version", value: 1, state: "stable" });
  });

  it("연속 bump → monotonic v1→v2→v3, retired 누적, bumpedAt ISO", () => {
    const r1 = svc.bump("sim.bitmap"); svc.bump("sim.bitmap");
    const r3 = svc.bump("sim.bitmap");
    expect(r1).toMatchObject({ oldVersion: "v1", newVersion: "v2" });
    expect(r3).toMatchObject({ oldVersion: "v2", newVersion: "v3" });
    expect(() => new Date(r3.bumpedAt).toISOString()).not.toThrow();
    expect(svc.listRetired("sim.bitmap")).toEqual(["v1", "v2"]);
  });

  it("새 prefix lazy 초기화 + 다른 prefix 격리", () => {
    expect(svc.getCurrent("sim.role-bitmap")).toBe("v1");
    svc.bump("sim.role-bitmap");
    expect(svc.getCurrent("sim.bitmap")).toBe("v1");
  });

  it("nowImpl 주입 → 결정론적 bumpedAt", () => {
    const det = new BitmapVersionService({ nowImpl: () => new Date("2026-05-02T00:00:00.000Z") });
    expect(det.bump("sim.bitmap").bumpedAt).toBe("2026-05-02T00:00:00.000Z");
  });
});
```

- [ ] **Step 3.1.2: 테스트 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter @qa-sdk/sim-auth-api test bitmap-version.service
```

기대: FAIL — `Cannot find module './bitmap-version.service.js'`.

- [ ] **Step 3.1.3: 최소 구현**

`bitmap-version.service.ts`:

```typescript
// @def.boundary sim-auth-api
// 시뮬용 monotonic counter — production catalog API와 분리 (spec §9 Stage 3).
import { Injectable } from "@nestjs/common";
import { buildVersionTag, parseVersionTag } from "sim-identifier-grammar";

export interface BumpResult {
  prefix: string;
  oldVersion: string;  // 예: "v1"
  newVersion: string;  // 예: "v2"
  bumpedAt: string;    // ISO-8601
}
export interface BitmapVersionServiceOptions { nowImpl?: () => Date; }
interface PrefixState { current: number; retired: number[]; }

@Injectable()
export class BitmapVersionService {
  private readonly state = new Map<string, PrefixState>();
  private readonly now: () => Date;
  constructor(opts?: BitmapVersionServiceOptions) {
    this.now = opts?.nowImpl ?? (() => new Date());
  }

  getCurrent(prefix: string): string {
    return this.tagOf(this.ensure(prefix).current);
  }

  bump(prefix: string): BumpResult {
    const s = this.ensure(prefix);
    const oldValue = s.current;
    s.retired.push(oldValue);
    s.current = oldValue + 1;
    const old = this.tagOf(oldValue);
    const next = this.tagOf(s.current);
    parseVersionTag(old); parseVersionTag(next); // grammar round-trip 검증
    return { prefix, oldVersion: old, newVersion: next, bumpedAt: this.now().toISOString() };
  }

  listRetired(prefix: string): string[] {
    return this.ensure(prefix).retired.map((v) => this.tagOf(v));
  }

  private tagOf(value: number): string {
    return buildVersionTag({ axis: "version", value, state: "stable" });
  }

  private ensure(prefix: string): PrefixState {
    let s = this.state.get(prefix);
    if (!s) { s = { current: 1, retired: [] }; this.state.set(prefix, s); }
    return s;
  }
}
```

- [ ] **Step 3.1.4: 테스트 통과 + 빌드**

```bash
pnpm --filter @qa-sdk/sim-auth-api test bitmap-version.service
pnpm --filter @qa-sdk/sim-auth-api build
```

기대: 4 PASS + tsc green.

- [ ] **Step 3.1.5: Commit**

```bash
git add simulations/enterprise-pm/services/auth-api/src/auth/bitmap-version/
git commit -m "feat(sim-auth-api): BitmapVersionService — monotonic counter + grammar VersionTag (spec §9)"
```

---

### Task 3.2: AdminBitmapVersionController + InternalIpGuard

**Files:** Create `admin-bitmap-version.controller.ts` (+ `.test.ts`)

spec §9 응답 shape:
- `POST /admin/bitmap/bump-version` body `{ prefix?: string }` (default `"sim.bitmap"`) → `{ prefix, oldVersion, newVersion, bumpedAt }`.
- `GET /admin/bitmap/version?prefix=sim.bitmap` → `{ prefix, version }`.

InternalIpGuard로 외부 IP 404 silent (spec §3). zod 위반은 RFC 7807 400 (spec §11).

- [ ] **Step 3.2.1: 실패 테스트 작성**

`admin-bitmap-version.controller.test.ts` — Fastify `inject()`로 `remoteAddress` 주입해 InternalIpGuard도 함께 검증한다.

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { BitmapVersionService } from "./bitmap-version.service.js";
import { AdminBitmapVersionController } from "./admin-bitmap-version.controller.js";

const INTERNAL_IP = "127.0.0.1";
const EXTERNAL_IP = "8.8.8.8";

describe("AdminBitmapVersionController (spec §9 Stage 3)", () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [AdminBitmapVersionController],
      providers: [BitmapVersionService],
    }).compile();
    app = m.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => { await app.close(); });

  const inj = (opts: Parameters<typeof app.inject>[0]) =>
    app.inject({ remoteAddress: INTERNAL_IP, ...opts });

  it("GET version (no query) → default sim.bitmap v1", async () => {
    const r = await inj({ method: "GET", url: "/admin/bitmap/version" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ prefix: "sim.bitmap", version: "v1" });
  });

  it("GET ?prefix=sim.role-bitmap → lazy v1", async () => {
    const r = await inj({ method: "GET", url: "/admin/bitmap/version?prefix=sim.role-bitmap" });
    expect(r.json()).toEqual({ prefix: "sim.role-bitmap", version: "v1" });
  });

  it("POST bump (empty body) → 201, v1→v2; 후속 GET 반영", async () => {
    const post = await inj({
      method: "POST", url: "/admin/bitmap/bump-version",
      payload: {}, headers: { "content-type": "application/json" },
    });
    expect(post.statusCode).toBe(201);
    expect(post.json()).toMatchObject({ prefix: "sim.bitmap", oldVersion: "v1", newVersion: "v2" });
    const get = await inj({ method: "GET", url: "/admin/bitmap/version" });
    expect(get.json()).toEqual({ prefix: "sim.bitmap", version: "v2" });
  });

  it("POST body 위반 (prefix='') → 400 + RFC 7807 (spec §11)", async () => {
    const r = await inj({
      method: "POST", url: "/admin/bitmap/bump-version",
      payload: { prefix: "" }, headers: { "content-type": "application/json" },
    });
    expect(r.statusCode).toBe(400);
    const body = r.json() as Record<string, unknown>;
    expect(body).toMatchObject({ status: 400 });
    expect(String(body.type)).toContain("validation");
  });

  it("외부 IP → 404 silent (spec §3)", async () => {
    const r = await app.inject({ method: "GET", url: "/admin/bitmap/version", remoteAddress: EXTERNAL_IP });
    expect(r.statusCode).toBe(404);
  });
});
```

- [ ] **Step 3.2.2: 테스트 실패 확인**

```bash
pnpm --filter @qa-sdk/sim-auth-api test admin-bitmap-version.controller
```

기대: FAIL — controller 미존재.

- [ ] **Step 3.2.3: 최소 구현**

`admin-bitmap-version.controller.ts`:

```typescript
// spec §9 응답 shape SSOT + spec §3 InternalIpGuard + spec §11 RFC 7807.
import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { InternalIpGuard } from "sim-internal-network";
import { BitmapVersionService } from "./bitmap-version.service.js";

const DEFAULT_PREFIX = "sim.bitmap";
const PrefixSchema = z.string()
  .min(1, { message: "prefix는 빈 문자열일 수 없다" })
  .regex(/^[a-z][a-z0-9.\-_]*$/, { message: "prefix는 소문자/숫자/.-_만 허용" });
const BumpBodySchema = z.object({ prefix: PrefixSchema.optional() }).strict();
const VersionQuerySchema = z.object({ prefix: PrefixSchema.optional() }).strict();

@Controller("admin/bitmap")
@UseGuards(InternalIpGuard)
export class AdminBitmapVersionController {
  constructor(private readonly service: BitmapVersionService) {}

  @Get("version")
  getVersion(@Query() raw: unknown) {
    const q = parse(VersionQuerySchema, raw, "query");
    const prefix = q.prefix ?? DEFAULT_PREFIX;
    return { prefix, version: this.service.getCurrent(prefix) };
  }

  @Post("bump-version")
  bumpVersion(@Body() raw: unknown) {
    const body = parse(BumpBodySchema, raw ?? {}, "body");
    return this.service.bump(body.prefix ?? DEFAULT_PREFIX);
  }
}

function parse<T>(schema: z.ZodSchema<T>, input: unknown, where: string): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  throw new BadRequestException({
    type: "https://qa-sdk.dev/errors/validation",
    title: "Bad Request", status: 400,
    detail: `${where} validation failed: ${r.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ")}`,
  });
}
```

- [ ] **Step 3.2.4: 테스트 통과**

```bash
pnpm --filter @qa-sdk/sim-auth-api test admin-bitmap-version.controller
```

기대: 5 PASS — GET default, GET named, POST 201 + 후속 GET v2, 400 zod, 404 외부 IP.

- [ ] **Step 3.2.5: Commit**

```bash
git add simulations/enterprise-pm/services/auth-api/src/auth/bitmap-version/admin-bitmap-version.controller*
git commit -m "feat(sim-auth-api): AdminBitmapVersionController — InternalIpGuard + zod RFC 7807 (spec §9, §3, §11)"
```

---

### Task 3.3: BitmapVersionModule 신설 + 의존 등록

**Files:** Create `bitmap-version.module.ts`. Modify `package.json`.

NestJS DI는 module 단위. service를 process-scoped singleton + controller 노출. 외부 module이 service를 import할 일 없으므로 export 두지 않음 (캡슐화).

- [ ] **Step 3.3.1: module 파일 작성**

`bitmap-version.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { AdminBitmapVersionController } from "./admin-bitmap-version.controller.js";
import { BitmapVersionService } from "./bitmap-version.service.js";

@Module({
  controllers: [AdminBitmapVersionController],
  providers: [BitmapVersionService],
})
export class BitmapVersionModule {}
```

- [ ] **Step 3.3.2: 의존 패키지 등록**

`package.json`의 `dependencies`에 추가:

```json
{
  "dependencies": {
    "sim-internal-network": "workspace:*",
    "sim-identifier-grammar": "workspace:*"
  }
}
```

```bash
pnpm install
```

기대: lock 갱신, install 성공.

- [ ] **Step 3.3.3: rebuild order 준수**

CLAUDE.md memory `feedback_monorepo-rebuild-order.md`: dist exports 패키지 수정 시 rebuild → 테스트 순서 준수.

```bash
pnpm --filter sim-identifier-grammar build
pnpm --filter sim-internal-network build
pnpm --filter @qa-sdk/sim-auth-api typecheck
```

기대: 3 패키지 순차 green.

- [ ] **Step 3.3.4: bitmap-version 묶음 테스트 통과**

```bash
pnpm --filter @qa-sdk/sim-auth-api test bitmap-version
```

기대: 9 PASS (Task 3.1의 4 + Task 3.2의 5). module boot 검증은 Task 3.4의 AppModule wiring에서.

- [ ] **Step 3.3.5: Commit**

```bash
git add simulations/enterprise-pm/services/auth-api/src/auth/bitmap-version/bitmap-version.module.ts \
        simulations/enterprise-pm/services/auth-api/package.json \
        pnpm-lock.yaml
git commit -m "feat(sim-auth-api): BitmapVersionModule + workspace deps (sim-internal-network, sim-identifier-grammar)"
```

---

### Task 3.4: AppModule wiring

**Files:** Modify `services/auth-api/src/app.module.ts`

BitmapVersionModule을 AppModule import 배열에 추가. 기존 BitmapSliceModule(권한 발행) / BitmapCacheModule(pub/sub) wiring과 namespace 충돌 없음.

- [ ] **Step 3.4.1: AppModule import 추가**

`app.module.ts`의 import 배열 끝에 `BitmapVersionModule` 추가:

```typescript
import { BitmapVersionModule } from "./auth/bitmap-version/bitmap-version.module.js";

@Module({
  imports: [
    HealthModule,
    AuthDbModule.forRoot(),
    ...STATIC_SLICE_MODULES,
    BitmapSliceModule.forRoot(buildBitmapIssuerConfig(env)),
    BitmapCacheModule.forRoot({ redisUrl: env.SIM_REDIS_URL, publisherEnabled: true, listenerEnabled: false, publisherName: "sim-auth-api" }),
    BitmapVersionModule, // ← 신규
  ],
})
export class AppModule {}
```

- [ ] **Step 3.4.2: app boot smoke**

```bash
pnpm --filter @qa-sdk/sim-auth-api test test-bootstrap
```

기대: PASS — `Nest application successfully started`.

- [ ] **Step 3.4.3: live route 검증 (manual)**

```bash
pnpm --filter @qa-sdk/sim-auth-api dev &
SERVER_PID=$!
sleep 3
curl -s http://127.0.0.1:4400/admin/bitmap/version
curl -s -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:4400/admin/bitmap/bump-version
curl -s http://127.0.0.1:4400/admin/bitmap/version
kill $SERVER_PID
```

기대: 3개 응답이 spec §9 shape 만족 (`{prefix,version}`, `{prefix,oldVersion,newVersion,bumpedAt}`, `{prefix,version}`에서 v1→v2 전이).

- [ ] **Step 3.4.4: 외부 IP 차단 manual 검증 (선택)**

host LAN IP에서 호출 → InternalIpGuard 동작 확인:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://<LAN-IP>:4400/admin/bitmap/version
```

기대: `404`.

- [ ] **Step 3.4.5: Commit**

```bash
git add simulations/enterprise-pm/services/auth-api/src/app.module.ts
git commit -m "feat(sim-auth-api): wire BitmapVersionModule into AppModule (Stage 3 endpoints active)"
```

---

### Task 3.5: sim-handles ↔ endpoint contract 검증

**Files:** Create `contract.test.ts`

spec §10 매트릭스의 *Contract* 행. sim-handles의 `bitmap-version-mutator` / `bitmap-version-check` factory가 기대하는 응답 shape을 endpoint가 그대로 만족하는지 확인 (drift 차단).

- [ ] **Step 3.5.1: contract 테스트 작성 — Fastify 임시 listen + 실제 fetch**

`contract.test.ts` — sim-handles factory를 실제 endpoint에 호출해 응답 shape이 spec §9 4/2 키를 그대로 만족하는지 검증한다. sim-handles는 source-only이므로 `scenarios/src/runner/sim-handles/`에서 직접 import.

```typescript
// spec §10 Stage 3 row — sim-handles bitmap-version-* ↔ admin endpoint shape.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { createBitmapVersionMutator } from "../../../../scenarios/src/runner/sim-handles/bitmap-version-mutator.js";
import { createBitmapVersionCheck } from "../../../../scenarios/src/runner/sim-handles/bitmap-version-check.js";
import { AdminBitmapVersionController } from "./admin-bitmap-version.controller.js";
import { BitmapVersionService } from "./bitmap-version.service.js";

describe("contract: sim-handles ↔ admin/bitmap (spec §10)", () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [AdminBitmapVersionController], providers: [BitmapVersionService],
    }).compile();
    app = m.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    await app.listen(0, "127.0.0.1");
    const addr = app.getHttpAdapter().getInstance().server.address();
    if (typeof addr !== "object" || !addr) throw new Error("listen addr unknown");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(async () => { await app.close(); });

  it("mutator → newVersion 매칭", async () => {
    const r = await createBitmapVersionMutator({ authApiUrl: baseUrl })();
    expect(r.newVersion).toMatch(/^v[1-9][0-9]*$/);
  });

  it("check → expected polling 통과", async () => {
    const cur = await fetch(`${baseUrl}/admin/bitmap/version`).then((r) => r.json()) as { version: string };
    const r = await createBitmapVersionCheck({ authApiUrl: baseUrl, pollIntervalMs: 10 })(cur.version, 1_000);
    expect(["version-check", "ttl"]).toContain(r.recoveredVia);
  });

  it("응답 키 — POST 4 키 / GET 2 키 (spec §9)", async () => {
    const post = await fetch(`${baseUrl}/admin/bitmap/bump-version`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    }).then((r) => r.json());
    expect(Object.keys(post as object).sort())
      .toEqual(["bumpedAt", "newVersion", "oldVersion", "prefix"].sort());
    const get = await fetch(`${baseUrl}/admin/bitmap/version`).then((r) => r.json());
    expect(Object.keys(get as object).sort()).toEqual(["prefix", "version"].sort());
  });
});
```

- [ ] **Step 3.5.2: 테스트 실행 + import 해석 점검**

```bash
pnpm --filter @qa-sdk/sim-auth-api test contract
```

해석 실패 시 Step 3.5.3에서 alias 보강.

- [ ] **Step 3.5.3: vitest alias 보강 (필요 시)**

`services/auth-api/vitest.config.ts`의 `resolve.alias`에 sim-handles workspace 경로 추가. 기존 alias 패턴 그대로.

- [ ] **Step 3.5.4: 테스트 통과 확정**

```bash
pnpm --filter @qa-sdk/sim-auth-api test contract
```

기대: 3 PASS — mutator 정합, check polling, 응답 키 spec §9 일치.

- [ ] **Step 3.5.5: Commit**

```bash
git add simulations/enterprise-pm/services/auth-api/src/auth/bitmap-version/contract.test.ts \
        simulations/enterprise-pm/services/auth-api/vitest.config.ts
git commit -m "test(sim-auth-api): contract — sim-handles bitmap-version ↔ admin endpoint (spec §10)"
```

---

### Task 3.6: bump pub/sub 갱신 (선택, 시나리오 16용)

**Files:** Modify `bitmap-version.service.ts` (+ `.test.ts`, `bitmap-version.module.ts`)

시나리오 16(`pubsub-invalidate-drop` fault)이 100% drop을 시뮬할 때, bump 시점에 `bitmap.invalidate` 메시지가 발사돼야 fault layer가 가로챌 거리가 생긴다. fail-open — redis 장애가 bump verdict를 차단하지 않는다.

- [ ] **Step 3.6.1: 실패 테스트 추가**

`bitmap-version.service.test.ts`에 두 케이스 추가:

```typescript
import { vi } from "vitest";

it("bump → publishInvalidate({ channel:'bitmap.invalidate', payload:{prefix,newVersion} })", () => {
  const publish = vi.fn();
  const det = new BitmapVersionService({ publishInvalidate: publish });
  const r = det.bump("sim.bitmap");
  expect(publish).toHaveBeenCalledWith({
    channel: "bitmap.invalidate",
    payload: { prefix: "sim.bitmap", newVersion: r.newVersion },
  });
});

it("publish reject는 bump 결과를 차단하지 않는다 (fail-open)", () => {
  const publish = vi.fn().mockRejectedValue(new Error("redis down"));
  expect(() => new BitmapVersionService({ publishInvalidate: publish }).bump("sim.bitmap")).not.toThrow();
});
```

- [ ] **Step 3.6.2: BitmapVersionService 확장 (publishInvalidate hook)**

`bitmap-version.service.ts`에 타입/필드/호출 추가:

```typescript
export interface InvalidateMessage {
  channel: "bitmap.invalidate";
  payload: { prefix: string; newVersion: string };
}
// options에: publishInvalidate?: (msg: InvalidateMessage) => Promise<void> | void
// constructor에: this.publishInvalidate = opts?.publishInvalidate;
// bump() return 직전:
try {
  void Promise.resolve(
    this.publishInvalidate?.({ channel: "bitmap.invalidate", payload: { prefix, newVersion: next } }),
  ).catch(() => { /* fail-open */ });
} catch { /* sync throw 흡수 */ }
```

- [ ] **Step 3.6.3: BitmapCacheModule publisher와 wiring**

`bitmap-version.module.ts`를 factory provider로 전환:

```typescript
import { BITMAP_INVALIDATION_PUBLISHER } from "@qa-sdk/sim-bitmap-cache";

@Module({
  controllers: [AdminBitmapVersionController],
  providers: [{
    provide: BitmapVersionService,
    inject: [BITMAP_INVALIDATION_PUBLISHER],
    useFactory: (publisher: { publish: (m: InvalidateMessage) => Promise<void> }) =>
      new BitmapVersionService({ publishInvalidate: (m) => publisher.publish(m) }),
  }],
})
export class BitmapVersionModule {}
```

> sim-bitmap-cache가 publisher token을 export하지 않으면 본 task 전체를 follow-up PR로 분리 (skip). fault drop=100% 케이스(no recovery)는 endpoint만으로도 검증된다 (Task 3.5).

- [ ] **Step 3.6.4: 통합 검증**

```bash
pnpm --filter @qa-sdk/sim-auth-api test bitmap-version
pnpm --filter @qa-sdk/sim-auth-api test test-bootstrap
```

기대: 11 PASS (Task 3.1의 4 + 3.2의 5 + 3.6의 2) + boot smoke green.

- [ ] **Step 3.6.5: Commit**

```bash
git add simulations/enterprise-pm/services/auth-api/src/auth/bitmap-version/
git commit -m "feat(sim-auth-api): bump publishes bitmap.invalidate (fail-open, scenario 16 happy path)"
```

---

### Task 3.7: Stage 3 통합 검증 + 무회귀

**Files:** (gate only — no commits)

Stage 3 머지 전 마지막 게이트. Task 3.1~3.6 통합 빌드 + 시나리오 1~8 무회귀 + DoD 매핑. 실패 시 앞선 task로 회귀.

- [ ] **Step 3.7.1: auth-api 단독 빌드 + 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter @qa-sdk/sim-auth-api build
pnpm --filter @qa-sdk/sim-auth-api test
```

기대: tsc green + 모든 vitest test green (BitmapVersion 11 + 기존 auth slice tests).

- [ ] **Step 3.7.2: 시나리오 1~8 무회귀**

`/admin/bitmap/*` 신규 endpoint 2종만 추가했으므로 기존 시나리오 1~8 (인증/권한/요청 처리 happy path)에 영향 없어야 한다:

```bash
pnpm --filter @qa-sdk/sim-enterprise-pm-scenarios test
```

기대: 시나리오 1~8 unit suite green. sim-handles bitmap-version-* 자체 unit test도 green (mock fetchImpl 기반).

- [ ] **Step 3.7.3: DoD 매핑 (spec §10 + §13)**

| 항목 | 검증 위치 |
|---|---|
| Unit (mock store) — version bump | Task 3.1 |
| Integration (NestJS Test + Fastify inject) — 2 endpoint | Task 3.2 |
| Contract (sim-handles ↔ shape) | Task 3.5 |
| InternalIpGuard 외부 IP 404 silent (spec §3) | Task 3.2 it #6 |
| RFC 7807 zod 400 (spec §11) | Task 3.2 it #5 |
| spec §9 응답 shape | Task 3.5 it #3 |
| pub/sub 발행 (선택, 시나리오 16) | Task 3.6 |

전 항목 PASS면 PR-C ready.

- [ ] **Step 3.7.4: PR 본문 초안**

```
## Stage 3 — auth-api admin/bitmap endpoints (PR-C)

spec: docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md §9
plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/C-stage-3-auth-api.md

### Endpoints
- POST /admin/bitmap/bump-version → { prefix, oldVersion, newVersion, bumpedAt }
- GET  /admin/bitmap/version?prefix=… → { prefix, version }

### Tests
- BitmapVersionService unit (4 + 선택 2)
- AdminBitmapVersionController integration (5, NestJS Test + Fastify inject)
- contract: sim-handles bitmap-version-mutator/check ↔ endpoint (3)

### Wiring
- workspace deps: sim-internal-network, sim-identifier-grammar
- AppModule: BitmapVersionModule import

### 회귀
- 시나리오 1~8 unit suite green
- auth-api test-bootstrap (NestFactory boot) green

### follow-ups
- Task 3.6 wiring이 sim-bitmap-cache token export 의존 — 미export 시 별도 PR.
- 운영급 admin 인증 (admin token, mTLS)은 본 사이클 범위 밖 (overview §1).
```

- [ ] **Step 3.7.5: 사용자에게 PR open 의뢰**

자동 push 금지 (CLAUDE.md memory `feedback_no-destructive-git.md`). 본 step은 plan 종료 시그널 — 사용자가 검토 후 push/PR open 결정.

기대: `Stage 3 ready — please review commits and run \`gh pr create\` when ok` 메시지.

---

## Stage 3 산출물 요약

| 카테고리 | 산출물 | 위치 |
|---|---|---|
| Service | BitmapVersionService (counter + grammar + publish hook) | `auth/bitmap-version/bitmap-version.service.ts` |
| Controller | AdminBitmapVersionController (GET/POST + InternalIpGuard + zod 400) | `auth/bitmap-version/admin-bitmap-version.controller.ts` |
| Module | BitmapVersionModule | `auth/bitmap-version/bitmap-version.module.ts` |
| Wiring | AppModule import | `app.module.ts` |
| Contract | sim-handles ↔ endpoint | `auth/bitmap-version/contract.test.ts` |
| Deps | sim-internal-network · sim-identifier-grammar | `package.json` |

## cross-ref

- spec: `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §3 · §9 Stage 3 · §10 Stage 3 row · §11.
- 상위 plan: `docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/00-overview.md`.
- 의존: Stage 1a `packages/sim-internal-network/` (InternalIpGuard) — 본 stage는 그 패키지 머지 후 시작 가능.
- 후속: 시나리오 16 e2e 검증은 Stage 4 머지 후 사용자 환경에서 수행 (overview DoD #2).
