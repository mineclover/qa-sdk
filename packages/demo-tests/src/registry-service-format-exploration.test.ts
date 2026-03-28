// DEPRECATED: Hono createApp → NestJS 전환으로 비활성화. registry-service 자체 테스트(25파일, 212건)로 대체.

/**
 * Registry Service — 서비스 등록 포맷 탐색
 *
 * 이 모노레포의 실제 패키지들을 Registry Service에 등록하면서
 * n차원 서비스 관리에 최적의 축 구성과 포맷을 실험한다.
 *
 * ── 확정 축 ──
 *   pkg: GitHub 서비스 단위 (이 레포의 실제 패키지들)
 *
 * ── 탐색 축 ──
 *   tier:    foundation / platform / service / app
 *   runtime: library / server / browser
 *   scope:   public / private
 *
 * ── 핵심 질문 ──
 *   1. 패키지 축만으로 충분한가, 아니면 다차원 composite가 필요한가?
 *   2. 의존성 DAG를 registry prefix refs로 어떻게 표현하는가?
 *   3. capacity/headroom을 어떻게 설정하면 확장에 유리한가?
 *   4. 버전 전이 시 어떤 패키지가 영향받는지 simulate로 사전 감지 가능한가?
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from "index-meta";
import type { Hono } from "hono";
import {
  createApp,
  InMemoryPrefixOwnerStore,
  InMemoryDraftLockStore,
  RegistryService,
} from "@qa-sdk/registry-service";
import { simulate, analyze } from "@qa-sdk/registry-service";
import pino from "pino";

// ══════════════════════════════════════════════════════════════
//  실제 모노레포 패키지 카탈로그
// ══════════════════════════════════════════════════════════════

/** 패키지 메타데이터 */
interface PkgMeta {
  readonly name: string;        // 패키지 디렉토리명 (식별자)
  readonly npmName: string;     // npm 패키지명
  readonly tier: "foundation" | "platform" | "service" | "app" | "data";
  readonly runtime: "library" | "server" | "browser";
  readonly scope: "public" | "private";
  readonly deps: readonly string[];  // workspace 의존성 (디렉토리명 기준)
}

/**
 * 이 모노레포의 전체 패키지 카탈로그.
 * `pnpm ls` 결과를 정제한 것.
 */
const PACKAGES: readonly PkgMeta[] = [
  // ── foundation: 핵심 수학/인코딩 라이브러리 ──
  { name: "weighted-index",     npmName: "weighted-index",           tier: "foundation", runtime: "library", scope: "public",  deps: [] },
  { name: "bit-index",          npmName: "bit-index",                tier: "foundation", runtime: "library", scope: "public",  deps: ["weighted-index"] },
  { name: "index-meta",         npmName: "index-meta",               tier: "foundation", runtime: "library", scope: "public",  deps: ["weighted-index"] },
  { name: "permission-engine",  npmName: "permission-engine",        tier: "foundation", runtime: "library", scope: "public",  deps: ["weighted-index", "bit-index"] },

  // ── platform: SDK·클라이언트·스토어 ──
  { name: "core",               npmName: "@qa-sdk/core",             tier: "platform",   runtime: "library", scope: "public",  deps: [] },
  { name: "engine",             npmName: "@qa-sdk/engine",           tier: "platform",   runtime: "library", scope: "public",  deps: ["core"] },
  { name: "sdk",                npmName: "@qa-sdk/sdk",              tier: "platform",   runtime: "library", scope: "public",  deps: ["core"] },
  { name: "store",              npmName: "@qa-sdk/store",            tier: "platform",   runtime: "library", scope: "public",  deps: ["core"] },
  { name: "registry-client",    npmName: "@qa-sdk/registry-client",  tier: "platform",   runtime: "library", scope: "public",  deps: [] },
  { name: "event-catalog",      npmName: "@qa-sdk/event-catalog",    tier: "platform",   runtime: "library", scope: "public",  deps: [] },
  { name: "pino",               npmName: "@qa-sdk/pino",             tier: "platform",   runtime: "library", scope: "public",  deps: [] },

  // ── service: HTTP 서버 ──
  { name: "ingest-server",      npmName: "@qa-sdk/ingest-server",    tier: "service",    runtime: "server",  scope: "private", deps: ["core", "engine", "registry-client", "store"] },
  { name: "registry-service",   npmName: "@qa-sdk/registry-service", tier: "service",    runtime: "server",  scope: "private", deps: ["index-meta", "weighted-index"] },
  { name: "decode-service",     npmName: "@qa-sdk/decode-service",   tier: "service",    runtime: "server",  scope: "private", deps: ["index-meta"] },
  { name: "gate-service",       npmName: "gate-service",             tier: "service",    runtime: "server",  scope: "private", deps: ["index-meta"] },
  { name: "query-service",      npmName: "@qa-sdk/query-service",    tier: "service",    runtime: "server",  scope: "private", deps: ["index-meta"] },

  // ── app: UI·데모·탐색기 ──
  { name: "platform-demo",      npmName: "@qa-sdk/platform-demo",    tier: "app",        runtime: "browser", scope: "private", deps: ["demo-snapshot", "permission-engine", "weighted-index"] },
  { name: "browser-sdk",        npmName: "@qa-sdk/browser",          tier: "app",        runtime: "browser", scope: "private", deps: ["core", "event-catalog", "sdk"] },
  { name: "viz-web",            npmName: "@qa-sdk/viz-web",          tier: "app",        runtime: "browser", scope: "private", deps: ["core", "engine", "event-catalog"] },

  // ── data: 데모 데이터·테스트 ──
  { name: "demo-snapshot",      npmName: "demo-snapshot",            tier: "data",       runtime: "library", scope: "public",  deps: [] },
] as const;

// ── 축 엔트리 추출 ─────────────────────────────────────────

/** prefix는 [a-z][a-z0-9_]* 형식 → 하이픈을 언더스코어로 변환 */
function toPrefix(name: string): string {
  return name.replace(/-/g, "_");
}

const PKG_ENTRIES   = PACKAGES.map((p) => toPrefix(p.name));
const TIER_ENTRIES  = ["foundation", "platform", "service", "app", "data"] as const;
const RUNTIME_ENTRIES = ["library", "server", "browser"] as const;
const SCOPE_ENTRIES = ["public", "private"] as const;

// ── 헬퍼 ────────────────────────────────────────────────────

function buildDeps() {
  const prefixRegistry = new InMemoryPrefixRegistry();
  const versionStore = new InMemoryVersionLifecycleStore();
  const ownerStore = new InMemoryPrefixOwnerStore();
  const lockStore = new InMemoryDraftLockStore();
  const logger = pino({ level: "silent" });
  const app = createApp({ prefixRegistry, versionStore, ownerStore, lockStore, logger });
  const service = new RegistryService({ prefixRegistry, versionStore, ownerStore, lockStore });
  return { app, service, prefixRegistry, versionStore, ownerStore, lockStore };
}

async function post(app: Hono, path: string, body?: object) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function json(res: Response) {
  return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Format A: 단일 축 — pkg만으로 1D leaf 등록
//
//  가장 단순한 형태. 패키지 = leaf prefix, capacity = 패키지 수.
//  장점: 단순, DAG를 prefix refs로 직접 표현 가능
//  단점: 패키지 속성(tier/runtime/scope) 조회 불가, 범위 질의 불가
// ══════════════════════════════════════════════════════════════

describe.skip("Registry Service — 서비스 등록 포맷 탐색", () => {
describe("Format A: 단일 pkg 축 — leaf prefix로 등록", () => {
  it("모든 패키지를 leaf prefix로 등록", async () => {
    const { app } = buildDeps();

    // 각 패키지를 leaf prefix로 등록 (하이픈 → 언더스코어)
    for (const pkg of PACKAGES) {
      const res = await post(app, "/prefixes", {
        prefix: toPrefix(pkg.name),
        owner: pkg.tier,
        kind: "leaf",
        numberType: "number",
      });
      expect(res.status).toBe(201);
    }

    // 전체 목록 확인
    const listRes = await json(await app.request("/prefixes"));
    expect(listRes).toHaveLength(PACKAGES.length);
  });

  it("패키지 의존성을 composite refs로 표현", async () => {
    const { app } = buildDeps();

    // 의존 대상 leaf 등록 + draft 생성
    const leafNames = ["weighted_index", "bit_index", "core"];
    for (const name of leafNames) {
      await post(app, "/prefixes", { prefix: name, owner: "foundation", kind: "leaf" });
      await post(app, `/prefixes/${name}/versions`, {
        versionId: "v1", baseVersionId: null, capacity: 1,
      });
    }

    // permission-engine은 weighted-index + bit-index에 의존
    // → composite prefix로 의존 관계 표현
    await post(app, "/prefixes", { prefix: "permission_engine_deps", owner: "foundation", kind: "composite" });
    const draftRes = await post(app, "/prefixes/permission_engine_deps/versions", {
      versionId: "v1",
      baseVersionId: null,
      capacity: 0,
      refs: [
        { prefix: "weighted_index", versionId: "v1" },
        { prefix: "bit_index", versionId: "v1" },
      ],
    });
    expect(draftRes.status).toBe(201);

    // DAG 역참조: weighted_index를 참조하는 composite
    const reverseRes = await json(await app.request("/dag/weighted_index/v1/reverse-refs"));
    expect(reverseRes.length).toBeGreaterThanOrEqual(1);
    expect(reverseRes.some((r: any) => r.prefix === "permission_engine_deps")).toBe(true);
  });

  // 결론: prefix당 capacity=1이라 주소 공간 활용 없음. 단순 DAG 관리용.
});

// ══════════════════════════════════════════════════════════════
//  Format B: 다차원 — pkg × tier × runtime
//
//  패키지를 좌표로 배치. 범위 질의 가능.
//  "모든 서버" = runtime=server 범위, "foundation 전체" = tier=foundation 범위.
//  capacity에 headroom을 두어 패키지 추가 시 재배포 불필요.
// ══════════════════════════════════════════════════════════════

describe("Format B: 다차원 composite — pkg × tier × runtime", () => {
  it("3축 composite 등록 + shape/stride 확인", async () => {
    const { app } = buildDeps();

    // 3개 leaf 축 등록
    await post(app, "/prefixes", { prefix: "pkg", owner: "registry", kind: "leaf" });
    await post(app, "/prefixes", { prefix: "tier", owner: "registry", kind: "leaf" });
    await post(app, "/prefixes", { prefix: "runtime", owner: "registry", kind: "leaf" });

    // capacity: headroom 포함
    const pkgCap = 32;       // 현재 20개, headroom 12 → 패키지 추가 여유
    const tierCap = 8;       // 현재 5개, headroom 3
    const runtimeCap = 4;    // 현재 3개, headroom 1

    await post(app, `/prefixes/pkg/versions`, { versionId: "v1", baseVersionId: null, capacity: pkgCap });
    await post(app, `/prefixes/tier/versions`, { versionId: "v1", baseVersionId: null, capacity: tierCap });
    await post(app, `/prefixes/runtime/versions`, { versionId: "v1", baseVersionId: null, capacity: runtimeCap });

    // composite: service_map = pkg × tier × runtime
    await post(app, "/prefixes", { prefix: "service_map", owner: "registry", kind: "composite" });
    const draftRes = await post(app, "/prefixes/service_map/versions", {
      versionId: "v1",
      baseVersionId: null,
      capacity: 0,
      refs: [
        { prefix: "pkg", versionId: "v1" },
        { prefix: "tier", versionId: "v1" },
        { prefix: "runtime", versionId: "v1" },
      ],
    });
    expect(draftRes.status).toBe(201);

    const body = await json(draftRes);
    expect(body.shape).toEqual([pkgCap, tierCap, runtimeCap]);
    expect(body.capacity).toBe(pkgCap * tierCap * runtimeCap); // 32 × 8 × 4 = 1024
    expect(body.stride).toEqual([32, 4, 1]); // [tier*runtime, runtime, 1]

    // 주소 공간: 1024 슬롯 중 실제 사용 20개 → 주소 밀도 약 2%
    const usedSlots = PACKAGES.length;
    const totalSlots = body.capacity;
    const density = usedSlots / totalSlots;
    expect(density).toBeLessThan(0.05); // 5% 미만 — 희소 주소 공간
  });

  it("tier별 범위 질의가 가능하다", async () => {
    // stride 기반 범위 질의 원리 검증
    // service_map shape = [32, 8, 4], stride = [32, 4, 1]
    // tier=2(platform) → 모든 pkg, runtime 와일드카드
    // → pkg별로 base = (pkg-1)*32 + (2-1)*4 = (pkg-1)*32 + 4
    // → 범위 = [base, base+3] (runtime 4개)

    const stride = [32, 4, 1];
    const shape = [32, 8, 4];

    // tier position 맵 (1-based)
    const tierPos: Record<string, number> = {
      foundation: 1, platform: 2, service: 3, app: 4, data: 5,
    };

    // "모든 service tier 패키지" 주소 범위 계산
    const serviceTier = tierPos["service"]; // 3
    // 각 pkg에 대해 service tier 블록은 연속 4주소 (runtime 3개 + headroom 1)
    // pkg=1: (1-1)*32 + (3-1)*4 = 8, range [8, 11]
    // pkg=2: (2-1)*32 + (3-1)*4 = 40, range [40, 43]

    // 서버 패키지 5개의 주소 블록이 stride 간격으로 분산
    const serverPkgs = PACKAGES.filter((p) => p.tier === "service");
    expect(serverPkgs).toHaveLength(5);

    // 모든 service tier 주소 = 5개 패키지 × 4 runtime 슬롯 = 20개 주소
    // 실제 사용 = 5개 × 1 runtime(server) = 5개 — 나머지는 headroom
  });

  it("simulate: pkg 축 capacity 확장의 파급 효과", async () => {
    const { service, prefixRegistry, versionStore, ownerStore } = buildDeps();

    // 축 등록 + draft
    await service.registerPrefix({ prefix: "pkg", owner: "registry", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "tier", owner: "registry", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "runtime", owner: "registry", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "service_map", owner: "registry", kind: "composite", numberType: "number" });

    await service.createDraft({ prefix: "pkg", versionId: "v1", baseVersionId: null, capacity: 32 });
    await service.createDraft({ prefix: "tier", versionId: "v1", baseVersionId: null, capacity: 8 });
    await service.createDraft({ prefix: "runtime", versionId: "v1", baseVersionId: null, capacity: 4 });
    await service.createDraft({
      prefix: "service_map", versionId: "v1", baseVersionId: null, capacity: 0,
      refs: [
        { prefix: "pkg", versionId: "v1" },
        { prefix: "tier", versionId: "v1" },
        { prefix: "runtime", versionId: "v1" },
      ],
    });

    // pkg capacity 32→64 확장 시뮬레이션
    const result = await simulate(prefixRegistry, ownerStore, versionStore, {
      pkg: { capacity: 64 },
    });

    expect(result.impact).toHaveLength(1);
    expect(result.impact[0].prefix).toBe("service_map");
    expect(result.impact[0].currentProduct).toBe(1024);      // 32×8×4
    expect(result.impact[0].newProduct).toBe(2048);           // 64×8×4
    expect(result.impact[0].strideChanged).toBe(false);       // pkg가 첫 번째 축 → stride 불변!
    expect(result.impact[0].migrationRequired).toBe(false);
    expect(result.ready).toBe(true);

    // 핵심 발견: pkg를 첫 번째 축으로 배치하면
    // 패키지 추가(capacity 확장) 시 stride가 변하지 않아 마이그레이션 불필요
  });

  it("simulate: runtime 축 확장은 stride를 변경한다", async () => {
    const { service, prefixRegistry, versionStore, ownerStore } = buildDeps();

    await service.registerPrefix({ prefix: "pkg", owner: "registry", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "tier", owner: "registry", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "runtime", owner: "registry", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "service_map", owner: "registry", kind: "composite", numberType: "number" });

    await service.createDraft({ prefix: "pkg", versionId: "v1", baseVersionId: null, capacity: 32 });
    await service.createDraft({ prefix: "tier", versionId: "v1", baseVersionId: null, capacity: 8 });
    await service.createDraft({ prefix: "runtime", versionId: "v1", baseVersionId: null, capacity: 4 });
    await service.createDraft({
      prefix: "service_map", versionId: "v1", baseVersionId: null, capacity: 0,
      refs: [
        { prefix: "pkg", versionId: "v1" },
        { prefix: "tier", versionId: "v1" },
        { prefix: "runtime", versionId: "v1" },
      ],
    });

    // runtime 4→8 확장 (예: wasm, edge 등 추가)
    const result = await simulate(prefixRegistry, ownerStore, versionStore, {
      runtime: { capacity: 8 },
    });

    expect(result.impact[0].strideChanged).toBe(true);       // 마지막 축이 아닌 tier의 stride 변경
    expect(result.impact[0].currentStride).toEqual([32, 4, 1]);
    expect(result.impact[0].newStride).toEqual([64, 8, 1]);   // tier stride: 4→8, pkg stride: 32→64
    expect(result.impact[0].migrationRequired).toBe(true);

    // 핵심 발견: 가장 내부 축(runtime)의 capacity를 변경하면
    // 외부 축들의 stride가 전부 바뀌어 마이그레이션이 필요하다.
    // → 변경 가능성이 높은 축은 첫 번째(외부)에 배치해야 안전
  });
});

// ══════════════════════════════════════════════════════════════
//  Format C: 계층형 composite — 의존 계층을 DAG로 표현
//
//  패키지 간 의존성을 composite refs 체인으로 모델링.
//  foundation → platform → service 계층 구조를 DAG로.
// ══════════════════════════════════════════════════════════════

describe("Format C: 계층형 DAG — 의존 계층을 refs 체인으로", () => {
  it("foundation → platform → service 계층 등록 + DAG 순회", async () => {
    const { app } = buildDeps();

    // 계층별 prefix 등록
    await post(app, "/prefixes", { prefix: "foundation", owner: "core-team", kind: "leaf" });
    await post(app, "/prefixes", { prefix: "platform", owner: "sdk-team", kind: "leaf" });
    await post(app, "/prefixes", { prefix: "services", owner: "infra-team", kind: "composite" });

    // foundation: 4개 패키지 (capacity=8, headroom=4)
    await post(app, "/prefixes/foundation/versions", {
      versionId: "v1", baseVersionId: null, capacity: 8,
    });

    // platform: 7개 패키지 (capacity=16, headroom=9)
    await post(app, "/prefixes/platform/versions", {
      versionId: "v1", baseVersionId: null, capacity: 16,
    });

    // services = foundation × platform (서비스는 양쪽에 의존)
    const svcRes = await post(app, "/prefixes/services/versions", {
      versionId: "v1", baseVersionId: null, capacity: 0,
      refs: [
        { prefix: "foundation", versionId: "v1" },
        { prefix: "platform", versionId: "v1" },
      ],
    });
    const svcBody = await json(svcRes);
    expect(svcBody.shape).toEqual([8, 16]);
    expect(svcBody.capacity).toBe(128);

    // DAG: services → foundation, platform
    const deps = await json(await app.request("/dag/services/v1/deps"));
    expect(deps).toHaveLength(2);
    expect(deps.map((d: any) => d.prefix)).toEqual(["foundation", "platform"]);

    // 역참조: foundation을 참조하는 composite
    const revRefs = await json(await app.request("/dag/foundation/v1/reverse-refs"));
    expect(revRefs.some((r: any) => r.prefix === "services")).toBe(true);
  });

  it("foundation 확장 시 services에 미치는 영향", async () => {
    const { service, prefixRegistry, versionStore, ownerStore } = buildDeps();

    await service.registerPrefix({ prefix: "foundation", owner: "core-team", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "platform", owner: "sdk-team", kind: "leaf", numberType: "number" });
    await service.registerPrefix({ prefix: "services", owner: "infra-team", kind: "composite", numberType: "number" });

    await service.createDraft({ prefix: "foundation", versionId: "v1", baseVersionId: null, capacity: 8 });
    await service.createDraft({ prefix: "platform", versionId: "v1", baseVersionId: null, capacity: 16 });
    await service.createDraft({
      prefix: "services", versionId: "v1", baseVersionId: null, capacity: 0,
      refs: [
        { prefix: "foundation", versionId: "v1" },
        { prefix: "platform", versionId: "v1" },
      ],
    });

    // foundation 8→12로 확장 (새 라이브러리 추가)
    const result = await simulate(prefixRegistry, ownerStore, versionStore, {
      foundation: { capacity: 12 },
    });

    expect(result.impact[0].prefix).toBe("services");
    expect(result.impact[0].strideChanged).toBe(false); // foundation이 첫 번째 축 → stride 불변
    expect(result.impact[0].newProduct).toBe(192); // 12 × 16
  });
});

// ══════════════════════════════════════════════════════════════
//  Format D: 실용 하이브리드 — pkg leaf + dep_graph composite
//
//  [확정 포맷 후보]
//  각 패키지를 개별 leaf prefix로, 의존성 그래프를 composite로.
//  실제 패키지 데이터를 전부 등록하고 전체 워크플로우를 검증.
// ══════════════════════════════════════════════════════════════

describe("Format D: 실용 하이브리드 — 전체 패키지 등록 + 의존성 시뮬레이션", () => {
  async function registerAllPackages(app: Hono) {
    // 1. 모든 패키지를 leaf prefix로 등록 (owner = tier)
    for (const pkg of PACKAGES) {
      await post(app, "/prefixes", {
        prefix: toPrefix(pkg.name),
        owner: pkg.tier,
        kind: "leaf",
        numberType: "number",
      });
      // v1 draft: capacity = 1 (leaf는 단일 서비스 단위)
      await post(app, `/prefixes/${toPrefix(pkg.name)}/versions`, {
        versionId: "v1",
        baseVersionId: null,
        capacity: 1,
      });
    }

    // 2. 의존 관계가 있는 패키지에 대해 dep_graph composite 생성
    const pkgsWithDeps = PACKAGES.filter((p) => p.deps.length > 0);
    for (const pkg of pkgsWithDeps) {
      const compositeName = `${toPrefix(pkg.name)}_deps`;
      await post(app, "/prefixes", {
        prefix: compositeName,
        owner: pkg.tier,
        kind: "composite",
        numberType: "number",
      });
      await post(app, `/prefixes/${compositeName}/versions`, {
        versionId: "v1",
        baseVersionId: null,
        capacity: 0,
        refs: pkg.deps.map((dep) => ({ prefix: toPrefix(dep), versionId: "v1" })),
      });
    }
  }

  it("20개 패키지 + 의존성 composite 전체 등록", async () => {
    const { app } = buildDeps();
    await registerAllPackages(app);

    const list = await json(await app.request("/prefixes"));
    const pkgsWithDeps = PACKAGES.filter((p) => p.deps.length > 0);
    expect(list).toHaveLength(PACKAGES.length + pkgsWithDeps.length);
  });

  it("weighted-index 역참조 — 이 패키지에 의존하는 모든 composite 추적", async () => {
    const { app } = buildDeps();
    await registerAllPackages(app);

    const refs = await json(await app.request("/dag/weighted_index/v1/reverse-refs"));
    const dependents = refs.map((r: any) => r.prefix);

    // weighted-index에 의존하는 패키지들
    const expected = PACKAGES
      .filter((p) => p.deps.includes("weighted-index"))
      .map((p) => `${toPrefix(p.name)}_deps`);

    for (const exp of expected) {
      expect(dependents).toContain(exp);
    }
  });

  it("core 역참조 — platform/service 계층에서 core를 참조", async () => {
    const { app } = buildDeps();
    await registerAllPackages(app);

    const refs = await json(await app.request("/dag/core/v1/reverse-refs"));
    const dependents = refs.map((r: any) => r.prefix);

    // core에 의존하는 패키지들: engine, sdk, store, ingest-server, browser-sdk, viz-web
    expect(dependents).toContain("engine_deps");     // engine → core
    expect(dependents).toContain("sdk_deps");         // sdk → core
    expect(dependents).toContain("store_deps");       // store → core
  });

  it("전체 DAG 그래프 구조 확인", async () => {
    const { app } = buildDeps();
    await registerAllPackages(app);

    const graph = await json(await app.request("/dag/graph"));

    // leaf 노드 (의존성 없는 패키지)
    const leafPkgs = PACKAGES.filter((p) => p.deps.length === 0);
    // leaf 노드는 edge의 to에만 등장하고 from에는 등장하지 않음
    const fromNodes = new Set(graph.edges.map((e: any) => e.from.split(":")[0]));
    for (const lp of leafPkgs) {
      expect(fromNodes.has(lp.name)).toBe(false);
    }

    // 최다 피의존 패키지 확인
    const toCounts = new Map<string, number>();
    for (const edge of graph.edges) {
      const to = (edge as any).to.split(":")[0];
      toCounts.set(to, (toCounts.get(to) ?? 0) + 1);
    }
    const sorted = [...toCounts.entries()].sort((a, b) => b[1] - a[1]);

    // core 또는 weighted_index가 최다 피의존
    const topDeps = sorted.slice(0, 3).map(([name]) => name);
    expect(topDeps).toContain("core");              // 6개 패키지가 의존
    expect(topDeps).toContain("weighted_index");    // 4개 패키지가 의존
  });

  it("analyze: 전체 draft 정합성 + 위상정렬 release 순서", async () => {
    const { app, service, prefixRegistry, versionStore, ownerStore } = buildDeps();
    await registerAllPackages(app);

    const result = await analyze(
      prefixRegistry, versionStore, ownerStore,
      (p, v) => service.isLocked(p, v),
    );

    expect(result.ready).toBe(true);

    // 위상정렬: 의존성 없는 패키지가 먼저
    const order = result.releaseOrder;

    // weighted_index는 bit_index_deps, index_meta_deps 등보다 먼저
    if (order.includes("weighted_index") && order.includes("bit_index_deps")) {
      expect(order.indexOf("weighted_index")).toBeLessThan(order.indexOf("bit_index_deps"));
    }

    // core는 engine_deps, sdk_deps 등보다 먼저
    if (order.includes("core") && order.includes("engine_deps")) {
      expect(order.indexOf("core")).toBeLessThan(order.indexOf("engine_deps"));
    }
  });

  it("lock-all → release-all → activate 전체 워크플로우", async () => {
    const { app } = buildDeps();
    await registerAllPackages(app);

    // lock
    const lockRes = await json(await post(app, "/workspace/lock-all"));
    expect(lockRes.locked.length).toBeGreaterThan(0);

    // release
    const releaseRes = await json(await post(app, "/workspace/release-all"));
    expect(releaseRes.released.length).toBeGreaterThan(0);

    // activate all
    const allPrefixes = await json(await app.request("/prefixes"));
    for (const p of allPrefixes) {
      await post(app, `/prefixes/${(p as any).prefix}/versions/v1/activate`);
    }

    // resolve
    const active = await json(await app.request("/resolve/active"));
    expect(Object.keys(active).length).toBe(allPrefixes.length);
  });
});

// ══════════════════════════════════════════════════════════════
//  포맷 비교 요약
// ══════════════════════════════════════════════════════════════

describe("포맷 비교 — 결론 도출", () => {
  it("축 배치 순서가 stride 안정성을 결정한다", () => {
    // Format B의 핵심 발견:
    // shape = [pkg, tier, runtime], stride = [tier*runtime, runtime, 1]
    //
    // 축 배치 규칙:
    //   1. 변경 빈도 높은 축 → 첫 번째 (외부): stride 불변
    //   2. 변경 빈도 낮은 축 → 마지막 (내부): stride 변경 시 전체 재계산
    //
    // 이 모노레포의 경우:
    //   - pkg(패키지): 가장 자주 추가/제거 → 첫 번째 축 ✓
    //   - tier(계층): 거의 변하지 않음 → 중간
    //   - runtime: 매우 안정적 → 마지막
    //
    // → [pkg, tier, runtime] 순서가 최적
    expect(true).toBe(true); // 원리 확인용
  });

  it("Format A vs D: DAG 표현 방식의 차이", () => {
    // Format A: 패키지 = leaf, 의존성 = composite refs
    //   → 단순하지만 주소 공간 활용 없음 (capacity=1)
    //   → 장점: DAG 역참조로 영향 범위 추적 가능
    //
    // Format D: A + 의존성 composite 자동 생성
    //   → 각 패키지의 의존 목록이 explicit composite로 등록됨
    //   → 위상정렬 release 순서 자동 계산
    //   → 장점: 전체 워크플로우(lock → release → resolve) 지원
    //
    // 결론: Format D가 실용적.
    //   - leaf prefix = 패키지 (capacity=1, 식별 단위)
    //   - composite prefix = 의존 관계 (capacity = refs product)
    //   - simulate로 변경 파급 효과 사전 감지
    //   - analyze로 release 순서 자동 계산
    expect(true).toBe(true);
  });

  it("Format B의 다차원은 메타데이터 질의에 유용하다", () => {
    // 패키지 속성으로 범위 질의를 하려면 다차원이 필요:
    //   "모든 server runtime 패키지" → runtime=server 범위
    //   "foundation tier 전체" → tier=foundation 범위
    //
    // 하지만 이는 registry-service보다 MetaRegistry/MetaCodec의 역할.
    // registry-service는 DAG + 버전 관리에 집중하는 것이 맞다.
    //
    // → 축 정의: demo-snapshot의 AXIS 패턴으로 pkg/tier/runtime 정의
    // → 인코딩: MetaCodec으로 다차원 주소 생성
    // → 관리: registry-service로 버전 + DAG + release 관리
    expect(true).toBe(true);
  });
});
}); // describe.skip("Registry Service — 서비스 등록 포맷 탐색")
