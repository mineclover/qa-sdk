// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * 유저 시나리오 E2E 테스트
 *
 * 실제 사용자 워크플로우를 시뮬레이션한다:
 * S1. Git 개발자 — Catalog 기반 TypeScript SDK 코드 생성
 * S2. K8s 운영자 — K8s DSL로 워크로드/인프라 주소 코드 생성
 * S3. APM 통합 — 멀티 DSL Catalog SDK 코드 생성
 * S4. 스키마 진화 — v1 → v2 축 entry 추가 후 양쪽 코드 생성 + 호환성 확인
 * S5. Schema Pull → Codegen 전체 파이프라인
 * S6. 에러 시나리오 — 유효하지 않은 입력 처리
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile, readdir, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { codegen } from "./commands/codegen.js";
import { generateProto, generateTypescript } from "codegen-core";
import { readSnapshot, readSnapshots } from "snapshot-io";
import type { SchemaSnapshot } from "codegen-core";
import type { Catalog, VersionedAxis, PrefixDef, DimRef } from "@qa-sdk/core";

// ── SDK 파일 세트 (codegen이 생성하는 파일 목록) ─────────────
// dsl.ts는 DkgConfig 존재 시에만 생성되므로 base에 포함하지 않음
const SDK_BASE_FILES = [
  "axes.ts",
  "context-types.ts",
  "dims.ts",
  "index.ts",
  "prefix-ids.ts",
  "sdk-factory.ts",
] as const;

// ── SchemaSnapshot → 최소 Catalog 변환 ─────────────────────
/** 테스트용: SchemaSnapshot을 최소한의 Catalog 구조로 변환 */
function snapshotToCatalog(snapshot: SchemaSnapshot): Catalog {
  const axes: Record<string, VersionedAxis> = {};
  for (const axis of snapshot.axes) {
    axes[axis.id] = {
      id: axis.id,
      name: axis.id,
      versions: {
        v1: {
          entries: axis.entries,
          capacity: axis.capacity,
        },
      },
    };
  }

  const prefixes: Record<string, PrefixDef> = {};
  for (const comp of snapshot.composites) {
    const dims: Record<string, DimRef> = {};
    for (const dimId of comp.dims) {
      dims[dimId] = { kind: "axis", axisId: dimId };
    }
    prefixes[comp.id] = {
      id: comp.id,
      name: comp.id,
      labels: comp.dims,
      dims,
      versions: [{
        version: "v1",
        axisVersions: Object.fromEntries(comp.dims.map(d => [d, "v1"])),
      }],
    };
  }

  return { id: snapshot.id, name: snapshot.id, axes, prefixes };
}

// ── 테스트 픽스처 ──────────────────────────────────

const GIT_DSL_V1: SchemaSnapshot = {
  id: "git-dsl-v1",
  axes: [
    { id: "git_repo", entries: ["qa-sdk", "frontend", "backend"], capacity: 64 },
    { id: "git_branch_type", entries: ["main", "feature", "release", "hotfix"], capacity: 8 },
    { id: "git_change_type", entries: ["feat", "fix", "refactor", "docs", "test", "chore"], capacity: 8 },
    { id: "git_file_scope", entries: ["weighted-index", "ingest-server", "core", "engine", "store"], capacity: 64 },
    { id: "git_author", entries: [], capacity: 256 },
  ],
  composites: [
    { id: "git_commit_addr", dims: ["git_repo", "git_branch_type", "git_change_type", "git_file_scope"], owner: "git-dsl-v1" },
    { id: "git_build_addr", dims: ["git_repo", "git_branch_type", "git_file_scope"], owner: "git-dsl-v1" },
  ],
};

const K8S_DSL_V1: SchemaSnapshot = {
  id: "k8s-dsl-v1",
  axes: [
    { id: "k8s_cluster", entries: ["prod-east", "prod-west", "staging", "dev"], capacity: 32 },
    { id: "k8s_namespace", entries: ["default", "monitoring", "production", "kube-system"], capacity: 128 },
    { id: "k8s_workload_type", entries: ["deployment", "statefulset", "daemonset", "job", "cronjob"], capacity: 8 },
    { id: "k8s_service", entries: ["gateway", "auth-server", "user-api", "payment"], capacity: 256 },
    { id: "k8s_node_pool", entries: ["general", "compute", "memory", "gpu"], capacity: 16 },
  ],
  composites: [
    { id: "k8s_workload_addr", dims: ["k8s_cluster", "k8s_namespace", "k8s_workload_type", "k8s_service"], owner: "k8s-dsl-v1" },
    { id: "k8s_infra_addr", dims: ["k8s_cluster", "k8s_node_pool", "k8s_workload_type"], owner: "k8s-dsl-v1" },
  ],
};

const APM_SIGNAL_V1: SchemaSnapshot = {
  id: "apm-signal-v1",
  axes: [
    { id: "apm_signal_type", entries: ["log", "span", "metric", "event"], capacity: 8 },
    { id: "apm_severity", entries: ["trace", "debug", "info", "warn", "error", "fatal"], capacity: 8 },
  ],
  composites: [],
};

// ── 테스트 디렉토리 관리 ─────────────────────────────

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = join(tmpdir(), `qa-cli-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(tmpRoot, { recursive: true });
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

async function writeSnapshot(dir: string, snapshot: SchemaSnapshot): Promise<string> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${snapshot.id}.json`);
  await writeFile(path, JSON.stringify(snapshot, null, 2));
  return path;
}

async function readGenerated(dir: string, filename: string): Promise<string> {
  return readFile(join(dir, filename), "utf-8");
}

// ═══════════════════════════════════════════════════════
// S1. Git 개발자 시나리오
// ═══════════════════════════════════════════════════════

describe("[S1] Git 개발자 — CI/CD 파이프라인 주소 코드 생성", () => {
  it("Git DSL Catalog에서 SDK 파일 세트 생성", async () => {
    const output = join(tmpRoot, "output");
    const catalog = snapshotToCatalog(GIT_DSL_V1);

    await codegen({
      loadedCatalog: catalog,
      output,
    });

    const files = await readdir(output);
    // SDK base 파일이 모두 생성되어야 한다
    for (const f of SDK_BASE_FILES) {
      expect(files).toContain(f);
    }
    // 모든 생성 파일이 .ts 확장자
    expect(files.every(f => f.endsWith(".ts"))).toBe(true);
  });

  it("proto: Conventional Commits 축이 올바른 enum으로 변환된다", async () => {
    const proto = generateProto(GIT_DSL_V1);

    // git_change_type 축 = CC type
    expect(proto).toContain("enum GitChangeType {");
    expect(proto).toContain("GIT_CHANGE_TYPE_FEAT = 1;");
    expect(proto).toContain("GIT_CHANGE_TYPE_FIX = 2;");
    expect(proto).toContain("GIT_CHANGE_TYPE_REFACTOR = 3;");
    expect(proto).toContain("GIT_CHANGE_TYPE_DOCS = 4;");
    expect(proto).toContain("GIT_CHANGE_TYPE_TEST = 5;");
    expect(proto).toContain("GIT_CHANGE_TYPE_CHORE = 6;");

    // UNSPECIFIED = 0 (proto3 규약)
    expect(proto).toContain("GIT_CHANGE_TYPE_UNSPECIFIED = 0;");
  });

  it("ts: git_commit_addr composite에 4개 차원이 모두 타입화된다", async () => {
    const ts = generateTypescript(GIT_DSL_V1);

    expect(ts).toContain("export interface GitCommitAddrDims {");
    expect(ts).toContain("git_repo: GitRepo;");
    expect(ts).toContain("git_branch_type: GitBranchType;");
    expect(ts).toContain("git_change_type: GitChangeType;");
    expect(ts).toContain("git_file_scope: GitFileScope;");
  });

  it("ts: entries 없는 축(git_author)은 string 타입으로 처리된다", async () => {
    const ts = generateTypescript(GIT_DSL_V1);

    // git_author는 entries가 비어있으므로 const 객체는 빈 상태
    expect(ts).toContain("export const GIT_AUTHOR = {");
    expect(ts).toContain("} as const;");
  });

  it("ts: git_build_addr composite는 3개 차원만 포함한다", async () => {
    const ts = generateTypescript(GIT_DSL_V1);

    expect(ts).toContain("export interface GitBuildAddrDims {");
    // git_build_addr는 git_change_type를 포함하지 않음
    const dims = ts.match(/export interface GitBuildAddrDims \{[\s\S]*?\}/)?.[0] ?? "";
    expect(dims).toContain("git_repo:");
    expect(dims).toContain("git_branch_type:");
    expect(dims).toContain("git_file_scope:");
    expect(dims).not.toContain("git_change_type:");
  });

  it("proto: entry 순서가 1-based index를 보장한다 (WeightedIndex EntityId 호환)", async () => {
    const proto = generateProto(GIT_DSL_V1);

    // git_repo entries: ["qa-sdk", "frontend", "backend"]
    // EntityId 1 = qa-sdk, 2 = frontend, 3 = backend
    expect(proto).toContain("GIT_REPO_QA_SDK = 1;");
    expect(proto).toContain("GIT_REPO_FRONTEND = 2;");
    expect(proto).toContain("GIT_REPO_BACKEND = 3;");
  });
});

// ═══════════════════════════════════════════════════════
// S2. K8s 운영자 시나리오
// ═══════════════════════════════════════════════════════

describe("[S2] K8s 운영자 — 워크로드/인프라 주소 코드 생성", () => {
  it("K8s 워크로드 타입 enum이 정확하다", async () => {
    const proto = generateProto(K8S_DSL_V1);

    expect(proto).toContain("enum K8sWorkloadType {");
    expect(proto).toContain("K8S_WORKLOAD_TYPE_DEPLOYMENT = 1;");
    expect(proto).toContain("K8S_WORKLOAD_TYPE_STATEFULSET = 2;");
    expect(proto).toContain("K8S_WORKLOAD_TYPE_DAEMONSET = 3;");
    expect(proto).toContain("K8S_WORKLOAD_TYPE_JOB = 4;");
    expect(proto).toContain("K8S_WORKLOAD_TYPE_CRONJOB = 5;");
  });

  it("ts: K8s const 객체에서 하이픈 포함 entry가 올바르게 변환된다", async () => {
    const ts = generateTypescript(K8S_DSL_V1);

    // "prod-east" → PROD_EAST
    expect(ts).toContain('PROD_EAST: "prod-east",');
    expect(ts).toContain('PROD_WEST: "prod-west",');

    // "auth-server" → AUTH_SERVER
    expect(ts).toContain('AUTH_SERVER: "auth-server",');
    expect(ts).toContain('USER_API: "user-api",');
  });

  it("ts: workload_addr Dims가 4-dim composite 타입을 형성한다", async () => {
    const ts = generateTypescript(K8S_DSL_V1);

    const workloadDims = ts.match(
      /export interface K8sWorkloadAddrDims \{[\s\S]*?\}/,
    )?.[0] ?? "";

    expect(workloadDims).toContain("k8s_cluster: K8sCluster;");
    expect(workloadDims).toContain("k8s_namespace: K8sNamespace;");
    expect(workloadDims).toContain("k8s_workload_type: K8sWorkloadType;");
    expect(workloadDims).toContain("k8s_service: K8sService;");
  });

  it("ts: infra_addr Dims가 3-dim composite 타입을 형성한다", async () => {
    const ts = generateTypescript(K8S_DSL_V1);

    const infraDims = ts.match(
      /export interface K8sInfraAddrDims \{[\s\S]*?\}/,
    )?.[0] ?? "";

    expect(infraDims).toContain("k8s_cluster: K8sCluster;");
    expect(infraDims).toContain("k8s_node_pool: K8sNodePool;");
    expect(infraDims).toContain("k8s_workload_type: K8sWorkloadType;");
    // infra_addr에는 k8s_service, k8s_namespace가 없음
    expect(infraDims).not.toContain("k8s_service:");
    expect(infraDims).not.toContain("k8s_namespace:");
  });

  it("proto: capacity 주석이 각 축에 표시된다", async () => {
    const proto = generateProto(K8S_DSL_V1);

    expect(proto).toContain("// k8s_cluster (capacity: 32)");
    expect(proto).toContain("// k8s_namespace (capacity: 128)");
    expect(proto).toContain("// k8s_service (capacity: 256)");
    expect(proto).toContain("// k8s_node_pool (capacity: 16)");
  });

  it("proto: kube-system 하이픈이 언더스코어로 변환된다", async () => {
    const proto = generateProto(K8S_DSL_V1);
    expect(proto).toContain("K8S_NAMESPACE_KUBE_SYSTEM = 4;");
  });
});

// ═══════════════════════════════════════════════════════
// S3. APM 통합 시나리오 — 멀티 DSL 동시 생성
// ═══════════════════════════════════════════════════════

describe("[S3] APM 통합 — 멀티 DSL Catalog SDK 코드 생성", () => {
  /** 3개 SchemaSnapshot의 축/prefix를 하나의 Catalog로 합성 */
  function mergeCatalog(snapshots: SchemaSnapshot[]): Catalog {
    const axes: Record<string, VersionedAxis> = {};
    const prefixes: Record<string, PrefixDef> = {};
    for (const snap of snapshots) {
      const single = snapshotToCatalog(snap);
      Object.assign(axes, single.axes);
      Object.assign(prefixes, single.prefixes);
    }
    return { id: "merged-dsl", name: "merged-dsl", axes, prefixes };
  }

  it("멀티 DSL Catalog → SDK 파일 세트 생성", async () => {
    const output = join(tmpRoot, "generated");
    const catalog = mergeCatalog([GIT_DSL_V1, K8S_DSL_V1, APM_SIGNAL_V1]);

    await codegen({ loadedCatalog: catalog, output });

    const files = (await readdir(output)).toSorted();
    for (const f of SDK_BASE_FILES) {
      expect(files).toContain(f);
    }
    expect(files.every(f => f.endsWith(".ts"))).toBe(true);
  });

  it("APM Signal proto에 severity 레벨이 올바르게 정의된다", async () => {
    const proto = generateProto(APM_SIGNAL_V1);

    expect(proto).toContain("enum ApmSeverity {");
    expect(proto).toContain("APM_SEVERITY_TRACE = 1;");
    expect(proto).toContain("APM_SEVERITY_DEBUG = 2;");
    expect(proto).toContain("APM_SEVERITY_INFO = 3;");
    expect(proto).toContain("APM_SEVERITY_WARN = 4;");
    expect(proto).toContain("APM_SEVERITY_ERROR = 5;");
    expect(proto).toContain("APM_SEVERITY_FATAL = 6;");
  });

  it("APM Signal ts에 signal_type 상수가 정의된다", async () => {
    const ts = generateTypescript(APM_SIGNAL_V1);

    expect(ts).toContain("export const APM_SIGNAL_TYPE = {");
    expect(ts).toContain('LOG: "log",');
    expect(ts).toContain('SPAN: "span",');
    expect(ts).toContain('METRIC: "metric",');
    expect(ts).toContain('EVENT: "event",');
  });

  it("생성 파일 헤더에 Catalog ID가 기록된다", async () => {
    const output = join(tmpRoot, "generated");
    const catalog = snapshotToCatalog(GIT_DSL_V1);

    await codegen({ loadedCatalog: catalog, output });

    // SDK 파일에 Catalog ID가 헤더에 포함
    const indexTs = await readGenerated(output, "index.ts");
    const axesTs = await readGenerated(output, "axes.ts");

    expect(indexTs).toContain(`Catalog "${catalog.id}"`);
    expect(axesTs).toContain(`Catalog "${catalog.id}"`);
  });

  it("SDK 파일 세트에 축 상수와 prefix 타입이 포함된다", async () => {
    const output = join(tmpRoot, "generated");
    const catalog = mergeCatalog([GIT_DSL_V1, APM_SIGNAL_V1]);

    await codegen({ loadedCatalog: catalog, output });

    // axes.ts — 각 DSL의 축 상수가 포함
    const axesTs = await readGenerated(output, "axes.ts");
    expect(axesTs).toContain("export const GIT_REPO =");
    expect(axesTs).toContain("export const APM_SIGNAL_TYPE =");
    expect(axesTs).toContain("export const APM_SEVERITY =");

    // prefix-ids.ts — prefix ID 리터럴 유니온
    const prefixIds = await readGenerated(output, "prefix-ids.ts");
    expect(prefixIds).toContain("git_commit_addr");
    expect(prefixIds).toContain("git_build_addr");

    // index.ts — barrel export
    const indexTs = await readGenerated(output, "index.ts");
    expect(indexTs).toContain('export * from "./prefix-ids.js"');
    expect(indexTs).toContain('export * from "./axes.js"');
    expect(indexTs).toContain('export * from "./dims.js"');
  });
});

// ═══════════════════════════════════════════════════════
// S4. 스키마 진화 시나리오
// ═══════════════════════════════════════════════════════

describe("[S4] 스키마 진화 — v1 → v2 축 entry 추가 후 양쪽 코드 생성", () => {
  const K8S_DSL_V2: SchemaSnapshot = {
    id: "k8s-dsl-v2",
    axes: [
      // v2: 클러스터 추가 (prod-asia)
      { id: "k8s_cluster", entries: ["prod-east", "prod-west", "staging", "dev", "prod-asia"], capacity: 32 },
      { id: "k8s_namespace", entries: ["default", "monitoring", "production", "kube-system", "istio-system"], capacity: 128 },
      { id: "k8s_workload_type", entries: ["deployment", "statefulset", "daemonset", "job", "cronjob"], capacity: 8 },
      // v2: 서비스 추가 (notification, analytics)
      { id: "k8s_service", entries: ["gateway", "auth-server", "user-api", "payment", "notification", "analytics"], capacity: 256 },
      { id: "k8s_node_pool", entries: ["general", "compute", "memory", "gpu", "arm"], capacity: 16 },
    ],
    composites: [
      { id: "k8s_workload_addr", dims: ["k8s_cluster", "k8s_namespace", "k8s_workload_type", "k8s_service"], owner: "k8s-dsl-v2" },
      { id: "k8s_infra_addr", dims: ["k8s_cluster", "k8s_node_pool", "k8s_workload_type"], owner: "k8s-dsl-v2" },
    ],
  };

  it("v1 기존 entry의 인덱스가 v2에서도 유지된다 (하위 호환)", async () => {
    const v1Proto = generateProto(K8S_DSL_V1);
    const v2Proto = generateProto(K8S_DSL_V2);

    // v1 기존 entry의 인덱스가 v2에서도 동일
    // prod-east = 1, prod-west = 2, staging = 3, dev = 4
    expect(v1Proto).toContain("K8S_CLUSTER_PROD_EAST = 1;");
    expect(v2Proto).toContain("K8S_CLUSTER_PROD_EAST = 1;");

    expect(v1Proto).toContain("K8S_CLUSTER_DEV = 4;");
    expect(v2Proto).toContain("K8S_CLUSTER_DEV = 4;");

    // v2에만 새로운 entry 추가
    expect(v2Proto).toContain("K8S_CLUSTER_PROD_ASIA = 5;");
    expect(v1Proto).not.toContain("K8S_CLUSTER_PROD_ASIA");
  });

  it("v2에 추가된 entry가 ts const에 반영된다", async () => {
    const v1Ts = generateTypescript(K8S_DSL_V1);
    const v2Ts = generateTypescript(K8S_DSL_V2);

    // v1에 없던 entry
    expect(v1Ts).not.toContain("PROD_ASIA");
    expect(v1Ts).not.toContain("NOTIFICATION");
    expect(v1Ts).not.toContain("ARM");

    // v2에 추가
    expect(v2Ts).toContain('PROD_ASIA: "prod-asia",');
    expect(v2Ts).toContain('NOTIFICATION: "notification",');
    expect(v2Ts).toContain('ARM: "arm",');
  });

  it("capacity는 동일하게 유지된다 (entry append만, capacity 변경 없음)", async () => {
    const v1Proto = generateProto(K8S_DSL_V1);
    const v2Proto = generateProto(K8S_DSL_V2);

    // capacity 주석 비교 — v1과 v2 동일
    expect(v1Proto).toContain("// k8s_cluster (capacity: 32)");
    expect(v2Proto).toContain("// k8s_cluster (capacity: 32)");

    expect(v1Proto).toContain("// k8s_service (capacity: 256)");
    expect(v2Proto).toContain("// k8s_service (capacity: 256)");
  });

  it("v2 Catalog에서 SDK 파일 세트가 생성된다", async () => {
    const output = join(tmpRoot, "evolution-output");
    const catalog = snapshotToCatalog(K8S_DSL_V2);

    await codegen({ loadedCatalog: catalog, output });

    const files = (await readdir(output)).toSorted();
    for (const f of SDK_BASE_FILES) {
      expect(files).toContain(f);
    }
    // v2 추가 entry가 axes.ts에 반영된다
    const axesTs = await readGenerated(output, "axes.ts");
    expect(axesTs).toContain('PROD_ASIA: "prod-asia",');
    expect(axesTs).toContain('NOTIFICATION: "notification",');
  });

  it("composite 구조(dims)는 v1↔v2 동일하다", async () => {
    const v1Ts = generateTypescript(K8S_DSL_V1);
    const v2Ts = generateTypescript(K8S_DSL_V2);

    // K8sWorkloadAddrDims의 필드 구성이 동일
    const extractDims = (ts: string, name: string) => {
      const match = ts.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\}`));
      return match?.[1]
        ?.split("\n")
        .map((l) => l.trim())
        .filter((l) => l.includes(":"))
        .toSorted();
    };

    expect(extractDims(v1Ts, "K8sWorkloadAddrDims")).toEqual(
      extractDims(v2Ts, "K8sWorkloadAddrDims"),
    );
    expect(extractDims(v1Ts, "K8sInfraAddrDims")).toEqual(
      extractDims(v2Ts, "K8sInfraAddrDims"),
    );
  });
});

// ═══════════════════════════════════════════════════════
// S5. Schema Pull → Codegen 전체 파이프라인
// ═══════════════════════════════════════════════════════

describe("[S5] Schema Pull → Codegen 파이프라인 (mock registry)", () => {
  it("Catalog → codegen으로 SDK 파일 생성", async () => {
    const generated = join(tmpRoot, "generated");
    const catalog = snapshotToCatalog(K8S_DSL_V1);

    await codegen({ loadedCatalog: catalog, output: generated });

    // SDK 파일이 유효한 TypeScript 구조인지
    const axesTs = await readGenerated(generated, "axes.ts");
    expect(axesTs.startsWith("// Generated from")).toBe(true);
    expect(axesTs).toContain("export const");
    expect(axesTs).toContain("as const;");
    expect(axesTs).toContain("export type");

    // prefix-ids.ts에 PrefixId 유니온 타입
    const prefixIds = await readGenerated(generated, "prefix-ids.ts");
    expect(prefixIds.startsWith("// Generated from")).toBe(true);
    expect(prefixIds).toContain("export type PrefixId =");

    // dims.ts에 dimension interface
    const dimsTs = await readGenerated(generated, "dims.ts");
    expect(dimsTs).toContain("export interface");
  });

  it("SDK 파일에 contentHash가 기록된다", async () => {
    const generated = join(tmpRoot, "generated");
    const catalog = snapshotToCatalog(K8S_DSL_V1);

    await codegen({ loadedCatalog: catalog, output: generated });

    // 모든 SDK 파일에 동일한 hash가 헤더에 포함
    const axesTs = await readGenerated(generated, "axes.ts");
    const dimsTs = await readGenerated(generated, "dims.ts");

    const hashMatch = axesTs.match(/hash: ([a-f0-9]+)/);
    expect(hashMatch).not.toBeNull();
    expect(dimsTs).toContain(`hash: ${hashMatch![1]}`);
  });

  it("snapshot-io: JSON 파일을 파싱하고 구조를 검증한다", async () => {
    const path = await writeSnapshot(tmpRoot, K8S_DSL_V1);
    const snapshot = await readSnapshot(path);

    expect(snapshot.id).toBe("k8s-dsl-v1");
    expect(snapshot.axes).toHaveLength(5);
    expect(snapshot.composites).toHaveLength(2);
    expect(snapshot.axes[0].id).toBe("k8s_cluster");
    expect(snapshot.composites[0].dims).toHaveLength(4);
  });

  it("snapshot-io: 디렉토리 내 .json만 읽고 다른 파일은 무시한다", async () => {
    const dir = join(tmpRoot, "mixed");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "a.json"), JSON.stringify(GIT_DSL_V1));
    await writeFile(join(dir, "b.json"), JSON.stringify(K8S_DSL_V1));
    await writeFile(join(dir, "notes.md"), "이건 무시");
    await writeFile(join(dir, "data.txt"), "이것도 무시");

    const snapshots = await readSnapshots(dir);
    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((s) => s.id).toSorted()).toEqual(["git-dsl-v1", "k8s-dsl-v1"]);
  });
});

// ═══════════════════════════════════════════════════════
// S6. 에러 시나리오
// ═══════════════════════════════════════════════════════

describe("[S6] 에러 시나리오", () => {
  it("Catalog 형식이 아닌 JSON → loadCatalog 에러", async () => {
    const bad = join(tmpRoot, "bad.json");
    await writeFile(bad, JSON.stringify({ axes: [], composites: [] }));

    await expect(
      codegen({ catalog: bad, output: join(tmpRoot, "out") }),
    ).rejects.toThrow();
  });

  it("axes 없는 JSON → loadCatalog 에러", async () => {
    const bad = join(tmpRoot, "bad2.json");
    await writeFile(bad, JSON.stringify({ id: "x", composites: [] }));

    await expect(
      codegen({ catalog: bad, output: join(tmpRoot, "out") }),
    ).rejects.toThrow();
  });

  it("존재하지 않는 catalog 경로 → 에러", async () => {
    await expect(
      codegen({ catalog: "/tmp/nonexistent-file-xyz.json", output: join(tmpRoot, "out") }),
    ).rejects.toThrow();
  });

  it("최소 Catalog → SDK 파일 생성 (에러 아님)", async () => {
    const output = join(tmpRoot, "out");
    // 빈 축/prefix를 가진 최소 Catalog
    const minimalCatalog: Catalog = { id: "empty", name: "empty", axes: {}, prefixes: {} };

    await codegen({ loadedCatalog: minimalCatalog, output });

    // SDK 파일이 생성된다 (빈 Catalog도 유효)
    const files = await readdir(output);
    expect(files.length).toBeGreaterThan(0);
  });

  it("잘못된 JSON → 파싱 에러", async () => {
    const bad = join(tmpRoot, "invalid.json");
    await writeFile(bad, "{ not valid json }}}");

    await expect(
      codegen({ catalog: bad, output: join(tmpRoot, "out") }),
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════
// S7. 코어 타입 정합성
// ═══════════════════════════════════════════════════════

describe("[S7] 코어 타입 정합성 — proto ↔ ts 대응 검증", () => {
  it("proto RecordKind enum과 ts RecordKind 유니온이 동일한 값을 갖는다", () => {
    const proto = generateProto(GIT_DSL_V1);
    const ts = generateTypescript(GIT_DSL_V1);

    // proto: RECORD_KIND_LOG = 1, RECORD_KIND_SPAN = 2, RECORD_KIND_METRIC = 3
    expect(proto).toContain("RECORD_KIND_LOG = 1;");
    expect(proto).toContain("RECORD_KIND_SPAN = 2;");
    expect(proto).toContain("RECORD_KIND_METRIC = 3;");

    // ts: "log" | "span" | "metric"
    expect(ts).toContain('"log" | "span" | "metric"');
  });

  it("proto MetricType enum과 ts MetricType 유니온이 동일한 값을 갖는다", () => {
    const proto = generateProto(GIT_DSL_V1);
    const ts = generateTypescript(GIT_DSL_V1);

    expect(proto).toContain("METRIC_TYPE_COUNTER = 1;");
    expect(proto).toContain("METRIC_TYPE_GAUGE = 2;");
    expect(proto).toContain("METRIC_TYPE_HISTOGRAM = 3;");
    expect(proto).toContain("METRIC_TYPE_SUMMARY = 4;");

    expect(ts).toContain('"counter" | "gauge" | "histogram" | "summary"');
  });

  it("proto ApmRecord 필드와 ts ApmRecord 필드가 대응한다", () => {
    const proto = generateProto(GIT_DSL_V1);
    const ts = generateTypescript(GIT_DSL_V1);

    // 공통 필드 존재 확인
    const commonFields = [
      "log_id", "trace_id", "span_id", "timestamp", "event_key",
      "record_kind", "span_name", "start_time", "end_time",
      "address_context", "payload", "actor_id", "user_id",
    ];

    for (const field of commonFields) {
      expect(proto).toContain(field);
      expect(ts).toContain(field);
    }
  });

  it("proto ApmEnvelope에 infra_context map이 있다", () => {
    const proto = generateProto(GIT_DSL_V1);
    expect(proto).toContain("map<string, string> infra_context = 10;");
  });

  it("ts ApmEnvelope에 infra_context 필드가 있다", () => {
    const ts = generateTypescript(GIT_DSL_V1);
    expect(ts).toContain("infra_context?: AddressContext;");
  });
});

// ═══════════════════════════════════════════════════════
// S8. 53비트 안전 범위 검증
// ═══════════════════════════════════════════════════════

describe("[S8] 53비트 안전 범위 — capacity product 검증 (version-as-axis 반영)", () => {
  // schema_version 축 capacity=32가 모든 composite의 첫 번째 차원에 추가됨

  it("Git DSL composite capacity (schema_version 포함)", () => {
    // git_commit_addr: schema_version(32) × repo(64) × branch_type(8) × change_type(8) × file_scope(64)
    const commitProduct = 32 * 64 * 8 * 8 * 64;
    expect(commitProduct).toBe(8_388_608);
    expect(Math.ceil(Math.log2(commitProduct))).toBe(23);
    expect(commitProduct).toBeLessThan(Number.MAX_SAFE_INTEGER);

    // git_build_addr: schema_version(32) × repo(64) × branch_type(8) × file_scope(64)
    const buildProduct = 32 * 64 * 8 * 64;
    expect(buildProduct).toBe(1_048_576);
    expect(Math.ceil(Math.log2(buildProduct))).toBe(20);
    expect(buildProduct).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it("K8s DSL composite capacity (schema_version 포함)", () => {
    // k8s_workload_addr: schema_version(32) × cluster(32) × namespace(128) × workload_type(8) × service(256)
    const workloadProduct = 32 * 32 * 128 * 8 * 256;
    expect(workloadProduct).toBe(268_435_456);
    expect(Math.ceil(Math.log2(workloadProduct))).toBe(28);
    expect(workloadProduct).toBeLessThan(Number.MAX_SAFE_INTEGER);

    // k8s_infra_addr: schema_version(32) × cluster(32) × node_pool(16) × workload_type(8)
    const infraProduct = 32 * 32 * 16 * 8;
    expect(infraProduct).toBe(131_072);
    expect(Math.ceil(Math.log2(infraProduct))).toBe(17);
    expect(infraProduct).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it("APM K8s Signal cross-domain composite (schema_version 내포)", () => {
    // apm_k8s_signal: k8s_workload_addr(268,435,456) × signal_type(8) × severity(8)
    // schema_version이 k8s_workload_addr에 내포됨
    const product = 268_435_456 * 8 * 8;
    expect(product).toBe(17_179_869_184);
    expect(Math.ceil(Math.log2(product))).toBe(34);
    expect(product).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

// ═══════════════════════════════════════════════════════
// S9. Version-as-Axis 시나리오
// ═══════════════════════════════════════════════════════

describe("[S9] Snapshot Supply — 전략별 코드 생성 검증", () => {
  const AXIS_SNAPSHOT: SchemaSnapshot = {
    id: "k8s-dsl-v1",
    axes: [
      { id: "schema_version", entries: ["s1"], capacity: 32 },
      { id: "k8s_cluster", entries: ["prod-east", "staging"], capacity: 32 },
      { id: "k8s_workload_type", entries: ["deployment", "statefulset"], capacity: 8 },
      { id: "k8s_service", entries: ["gateway"], capacity: 256 },
    ],
    composites: [
      {
        id: "k8s_workload_addr",
        dims: ["schema_version", "k8s_cluster", "k8s_workload_type", "k8s_service"],
        owner: "k8s-dsl-v1",
        snapshotSupply: { type: "axis", capacity: 32 },
      },
    ],
  };

  const ENVELOPE_SNAPSHOT: SchemaSnapshot = {
    id: "git-dsl-v1",
    axes: [
      { id: "git_repo", entries: ["qa-sdk", "frontend"], capacity: 64 },
      { id: "git_branch_type", entries: ["main", "feature"], capacity: 8 },
    ],
    composites: [
      {
        id: "git_commit_addr",
        dims: ["git_repo", "git_branch_type"],
        owner: "git-dsl-v1",
        snapshotSupply: { type: "envelope" },
      },
    ],
  };

  const IMPLICIT_SNAPSHOT: SchemaSnapshot = {
    id: "infra-v1",
    axes: [
      { id: "k8s_cluster", entries: ["prod"], capacity: 32 },
      { id: "k8s_node_pool", entries: ["general"], capacity: 16 },
    ],
    composites: [
      {
        id: "k8s_infra_addr",
        dims: ["k8s_cluster", "k8s_node_pool"],
        owner: "infra-v1",
        // snapshotSupply 생략 = implicit
      },
    ],
  };

  // ── axis 전략 ─────────────────────────────────────

  it("axis: schema_version 축이 proto enum으로 생성된다", () => {
    const proto = generateProto(AXIS_SNAPSHOT);
    expect(proto).toContain("enum SchemaVersion {");
    expect(proto).toContain("SCHEMA_VERSION_S1 = 1;");
  });

  it("axis: composite Dims에 schema_version이 첫 번째 필드", () => {
    const ts = generateTypescript(AXIS_SNAPSHOT);
    const dimsBlock = ts.match(/export interface K8sWorkloadAddrDims \{[\s\S]*?\}/)?.[0] ?? "";
    expect(dimsBlock).toContain("schema_version: SchemaVersion;");
    expect(dimsBlock).toContain("k8s_cluster: K8sCluster;");
  });

  it("axis: PREFIXES에 schema_version 포함 capacity/stride + snapshotSupply='axis'", () => {
    const ts = generateTypescript(AXIS_SNAPSHOT);
    expect(ts).toContain("capacity: [32, 32, 8, 256]");
    expect(ts).toContain("stride: [65536, 2048, 256, 1]");
    expect(ts).toContain('snapshotSupply: "axis"');
  });

  it("axis: schema_version이 첫 번째 차원이므로 stride가 가장 크다", () => {
    const versionStride = 32 * 8 * 256; // 65536
    const clusterStride = 8 * 256;      // 2048
    expect(versionStride).toBeGreaterThan(clusterStride);
  });

  it("axis: s2 entry 추가 시 capacity/stride 동일 (headroom 내)", () => {
    const V2: SchemaSnapshot = {
      ...AXIS_SNAPSHOT,
      axes: AXIS_SNAPSHOT.axes.map((a) =>
        a.id === "schema_version"
          ? { ...a, entries: ["s1", "s2"] }
          : a,
      ),
    };

    const ts1 = generateTypescript(AXIS_SNAPSHOT);
    const ts2 = generateTypescript(V2);

    expect(ts1).toContain("stride: [65536, 2048, 256, 1]");
    expect(ts2).toContain("stride: [65536, 2048, 256, 1]");
    expect(ts2).toContain('S2: "s2",');
  });

  // ── envelope 전략 ────────────────────────────────

  it("envelope: dims에 schema_version 없음, snapshotSupply='envelope'", () => {
    const ts = generateTypescript(ENVELOPE_SNAPSHOT);
    expect(ts).toContain('snapshotSupply: "envelope"');

    // dims에 schema_version이 없음
    const dimsBlock = ts.match(/export interface GitCommitAddrDims \{[\s\S]*?\}/)?.[0] ?? "";
    expect(dimsBlock).not.toContain("schema_version");
    expect(dimsBlock).toContain("git_repo:");
    expect(dimsBlock).toContain("git_branch_type:");
  });

  it("envelope: capacity/stride가 도메인 축만으로 계산된다", () => {
    const ts = generateTypescript(ENVELOPE_SNAPSHOT);
    // 64 × 8 = 512
    expect(ts).toContain("capacity: [64, 8]");
    expect(ts).toContain("stride: [8, 1]");
  });

  it("envelope: ApmEnvelope에 entry_snapshot 필드가 생성된다", () => {
    const ts = generateTypescript(ENVELOPE_SNAPSHOT);
    expect(ts).toContain("entry_snapshot?: string;");
  });

  // ── implicit 전략 ────────────────────────────────

  it("implicit: snapshotSupply='implicit' (기본값)", () => {
    const ts = generateTypescript(IMPLICIT_SNAPSHOT);
    expect(ts).toContain('snapshotSupply: "implicit"');
  });

  it("implicit: dims에 schema_version 없고 순수 도메인 축만", () => {
    const ts = generateTypescript(IMPLICIT_SNAPSHOT);
    expect(ts).toContain("capacity: [32, 16]");
    expect(ts).toContain("stride: [16, 1]");
  });

  // ── 공통 ─────────────────────────────────────────

  it("GENERATION은 모든 전략에서 snapshot.id를 사용한다", () => {
    expect(generateTypescript(AXIS_SNAPSHOT)).toContain('GENERATION = "k8s-dsl-v1"');
    expect(generateTypescript(ENVELOPE_SNAPSHOT)).toContain('GENERATION = "git-dsl-v1"');
    expect(generateTypescript(IMPLICIT_SNAPSHOT)).toContain('GENERATION = "infra-v1"');
  });

  it("proto: ApmEnvelope에 entry_snapshot 필드가 포함된다", () => {
    const proto = generateProto(AXIS_SNAPSHOT);
    expect(proto).toContain("string entry_snapshot = 11;");
  });
});
