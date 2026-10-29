// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * 유저 시나리오 E2E 테스트
 *
 * 실제 사용자 워크플로우를 시뮬레이션한다:
 * S1. Git 개발자 — Catalog 기반 TypeScript SDK 코드 생성
 * S3. APM 통합 — 멀티 DSL Catalog SDK 코드 생성
 * S4. 스키마 진화 — v1 → v2 축 entry 추가 후 양쪽 코드 생성 + 호환성 확인
 * S5. Schema Pull → Codegen 전체 파이프라인
 * S6. 에러 시나리오 — 유효하지 않은 입력 처리
 * S8. 53비트 안전 범위 — capacity product
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { codegen } from './commands/codegen.js';
import { readSnapshot, readSnapshots } from 'snapshot-io';
import type { SchemaSnapshot } from 'codegen-core';
import type { Catalog, VersionedAxis, PrefixDef, DimRef } from '@qa-sdk/core';

// ── SDK 파일 세트 (codegen이 생성하는 파일 목록) ─────────────
// dsl.ts는 DkgConfig 존재 시에만 생성되므로 base에 포함하지 않음
const SDK_BASE_FILES = [
  'axes.ts',
  'context-types.ts',
  'dims.ts',
  'index.ts',
  'prefix-ids.ts',
  'sdk-factory.ts',
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
      dims[dimId] = { kind: 'axis', axisId: dimId };
    }
    prefixes[comp.id] = {
      id: comp.id,
      name: comp.id,
      labels: comp.dims,
      dims,
      versions: [
        {
          version: 'v1',
          axisVersions: Object.fromEntries(comp.dims.map((d) => [d, 'v1'])),
        },
      ],
    };
  }

  return { id: snapshot.id, name: snapshot.id, axes, prefixes };
}

// ── 테스트 픽스처 ──────────────────────────────────

const GIT_DSL_V1: SchemaSnapshot = {
  id: 'git-dsl-v1',
  axes: [
    { id: 'git_repo', entries: ['qa-sdk', 'frontend', 'backend'], capacity: 64 },
    { id: 'git_branch_type', entries: ['main', 'feature', 'release', 'hotfix'], capacity: 8 },
    {
      id: 'git_change_type',
      entries: ['feat', 'fix', 'refactor', 'docs', 'test', 'chore'],
      capacity: 8,
    },
    {
      id: 'git_file_scope',
      entries: ['weighted-index', 'ingest-server', 'core', 'engine', 'store'],
      capacity: 64,
    },
    { id: 'git_author', entries: [], capacity: 256 },
  ],
  composites: [
    {
      id: 'git_commit_addr',
      dims: ['git_repo', 'git_branch_type', 'git_change_type', 'git_file_scope'],
      owner: 'git-dsl-v1',
    },
    {
      id: 'git_build_addr',
      dims: ['git_repo', 'git_branch_type', 'git_file_scope'],
      owner: 'git-dsl-v1',
    },
  ],
};

const K8S_DSL_V1: SchemaSnapshot = {
  id: 'k8s-dsl-v1',
  axes: [
    { id: 'k8s_cluster', entries: ['prod-east', 'prod-west', 'staging', 'dev'], capacity: 32 },
    {
      id: 'k8s_namespace',
      entries: ['default', 'monitoring', 'production', 'kube-system'],
      capacity: 128,
    },
    {
      id: 'k8s_workload_type',
      entries: ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'],
      capacity: 8,
    },
    {
      id: 'k8s_service',
      entries: ['gateway', 'auth-server', 'user-api', 'payment'],
      capacity: 256,
    },
    { id: 'k8s_node_pool', entries: ['general', 'compute', 'memory', 'gpu'], capacity: 16 },
  ],
  composites: [
    {
      id: 'k8s_workload_addr',
      dims: ['k8s_cluster', 'k8s_namespace', 'k8s_workload_type', 'k8s_service'],
      owner: 'k8s-dsl-v1',
    },
    {
      id: 'k8s_infra_addr',
      dims: ['k8s_cluster', 'k8s_node_pool', 'k8s_workload_type'],
      owner: 'k8s-dsl-v1',
    },
  ],
};

const APM_SIGNAL_V1: SchemaSnapshot = {
  id: 'apm-signal-v1',
  axes: [
    { id: 'apm_signal_type', entries: ['log', 'span', 'metric', 'event'], capacity: 8 },
    {
      id: 'apm_severity',
      entries: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      capacity: 8,
    },
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
  return readFile(join(dir, filename), 'utf-8');
}

// ═══════════════════════════════════════════════════════
// S1. Git 개발자 시나리오
// ═══════════════════════════════════════════════════════

describe('[S1] Git 개발자 — CI/CD 파이프라인 주소 코드 생성', () => {
  it('Git DSL Catalog에서 SDK 파일 세트 생성', async () => {
    const output = join(tmpRoot, 'output');
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
    expect(files.every((f) => f.endsWith('.ts'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// S2. K8s 운영자 시나리오
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// S3. APM 통합 시나리오 — 멀티 DSL 동시 생성
// ═══════════════════════════════════════════════════════

describe('[S3] APM 통합 — 멀티 DSL Catalog SDK 코드 생성', () => {
  /** 3개 SchemaSnapshot의 축/prefix를 하나의 Catalog로 합성 */
  function mergeCatalog(snapshots: SchemaSnapshot[]): Catalog {
    const axes: Record<string, VersionedAxis> = {};
    const prefixes: Record<string, PrefixDef> = {};
    for (const snap of snapshots) {
      const single = snapshotToCatalog(snap);
      Object.assign(axes, single.axes);
      Object.assign(prefixes, single.prefixes);
    }
    return { id: 'merged-dsl', name: 'merged-dsl', axes, prefixes };
  }

  it('멀티 DSL Catalog → SDK 파일 세트 생성', async () => {
    const output = join(tmpRoot, 'generated');
    const catalog = mergeCatalog([GIT_DSL_V1, K8S_DSL_V1, APM_SIGNAL_V1]);

    await codegen({ loadedCatalog: catalog, output });

    const files = (await readdir(output)).toSorted();
    for (const f of SDK_BASE_FILES) {
      expect(files).toContain(f);
    }
    expect(files.every((f) => f.endsWith('.ts'))).toBe(true);
  });

  it('생성 파일 헤더에 Catalog ID가 기록된다', async () => {
    const output = join(tmpRoot, 'generated');
    const catalog = snapshotToCatalog(GIT_DSL_V1);

    await codegen({ loadedCatalog: catalog, output });

    // SDK 파일에 Catalog ID가 헤더에 포함
    const indexTs = await readGenerated(output, 'index.ts');
    const axesTs = await readGenerated(output, 'axes.ts');

    expect(indexTs).toContain(`Catalog "${catalog.id}"`);
    expect(axesTs).toContain(`Catalog "${catalog.id}"`);
  });

  it('SDK 파일 세트에 축 상수와 prefix 타입이 포함된다', async () => {
    const output = join(tmpRoot, 'generated');
    const catalog = mergeCatalog([GIT_DSL_V1, APM_SIGNAL_V1]);

    await codegen({ loadedCatalog: catalog, output });

    // axes.ts — 각 DSL의 축 상수가 포함
    const axesTs = await readGenerated(output, 'axes.ts');
    expect(axesTs).toContain('export const GIT_REPO =');
    expect(axesTs).toContain('export const APM_SIGNAL_TYPE =');
    expect(axesTs).toContain('export const APM_SEVERITY =');

    // prefix-ids.ts — prefix ID 리터럴 유니온
    const prefixIds = await readGenerated(output, 'prefix-ids.ts');
    expect(prefixIds).toContain('git_commit_addr');
    expect(prefixIds).toContain('git_build_addr');

    // index.ts — barrel export
    const indexTs = await readGenerated(output, 'index.ts');
    expect(indexTs).toContain('export * from "./prefix-ids.js"');
    expect(indexTs).toContain('export * from "./axes.js"');
    expect(indexTs).toContain('export * from "./dims.js"');
  });
});

// ═══════════════════════════════════════════════════════
// S4. 스키마 진화 시나리오
// ═══════════════════════════════════════════════════════

describe('[S4] 스키마 진화 — v1 → v2 축 entry 추가 후 양쪽 코드 생성', () => {
  const K8S_DSL_V2: SchemaSnapshot = {
    id: 'k8s-dsl-v2',
    axes: [
      // v2: 클러스터 추가 (prod-asia)
      {
        id: 'k8s_cluster',
        entries: ['prod-east', 'prod-west', 'staging', 'dev', 'prod-asia'],
        capacity: 32,
      },
      {
        id: 'k8s_namespace',
        entries: ['default', 'monitoring', 'production', 'kube-system', 'istio-system'],
        capacity: 128,
      },
      {
        id: 'k8s_workload_type',
        entries: ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'],
        capacity: 8,
      },
      // v2: 서비스 추가 (notification, analytics)
      {
        id: 'k8s_service',
        entries: ['gateway', 'auth-server', 'user-api', 'payment', 'notification', 'analytics'],
        capacity: 256,
      },
      {
        id: 'k8s_node_pool',
        entries: ['general', 'compute', 'memory', 'gpu', 'arm'],
        capacity: 16,
      },
    ],
    composites: [
      {
        id: 'k8s_workload_addr',
        dims: ['k8s_cluster', 'k8s_namespace', 'k8s_workload_type', 'k8s_service'],
        owner: 'k8s-dsl-v2',
      },
      {
        id: 'k8s_infra_addr',
        dims: ['k8s_cluster', 'k8s_node_pool', 'k8s_workload_type'],
        owner: 'k8s-dsl-v2',
      },
    ],
  };

  it('v2 Catalog에서 SDK 파일 세트가 생성된다', async () => {
    const output = join(tmpRoot, 'evolution-output');
    const catalog = snapshotToCatalog(K8S_DSL_V2);

    await codegen({ loadedCatalog: catalog, output });

    const files = (await readdir(output)).toSorted();
    for (const f of SDK_BASE_FILES) {
      expect(files).toContain(f);
    }
    // v2 추가 entry가 axes.ts에 반영된다
    const axesTs = await readGenerated(output, 'axes.ts');
    expect(axesTs).toContain('PROD_ASIA: "prod-asia",');
    expect(axesTs).toContain('NOTIFICATION: "notification",');
  });
});

// ═══════════════════════════════════════════════════════
// S5. Schema Pull → Codegen 전체 파이프라인
// ═══════════════════════════════════════════════════════

describe('[S5] Schema Pull → Codegen 파이프라인 (mock registry)', () => {
  it('Catalog → codegen으로 SDK 파일 생성', async () => {
    const generated = join(tmpRoot, 'generated');
    const catalog = snapshotToCatalog(K8S_DSL_V1);

    await codegen({ loadedCatalog: catalog, output: generated });

    // SDK 파일이 유효한 TypeScript 구조인지
    const axesTs = await readGenerated(generated, 'axes.ts');
    expect(axesTs.startsWith('// Generated from')).toBe(true);
    expect(axesTs).toContain('export const');
    expect(axesTs).toContain('as const;');
    expect(axesTs).toContain('export type');

    // prefix-ids.ts에 PrefixId 유니온 타입
    const prefixIds = await readGenerated(generated, 'prefix-ids.ts');
    expect(prefixIds.startsWith('// Generated from')).toBe(true);
    expect(prefixIds).toContain('export type PrefixId =');

    // dims.ts에 dimension interface
    const dimsTs = await readGenerated(generated, 'dims.ts');
    expect(dimsTs).toContain('export interface');
  });

  it('SDK 파일에 contentHash가 기록된다', async () => {
    const generated = join(tmpRoot, 'generated');
    const catalog = snapshotToCatalog(K8S_DSL_V1);

    await codegen({ loadedCatalog: catalog, output: generated });

    // 모든 SDK 파일에 동일한 hash가 헤더에 포함
    const axesTs = await readGenerated(generated, 'axes.ts');
    const dimsTs = await readGenerated(generated, 'dims.ts');

    const hashMatch = axesTs.match(/hash: ([a-f0-9]+)/);
    expect(hashMatch).not.toBeNull();
    expect(dimsTs).toContain(`hash: ${hashMatch![1]}`);
  });

  it('snapshot-io: JSON 파일을 파싱하고 구조를 검증한다', async () => {
    const path = await writeSnapshot(tmpRoot, K8S_DSL_V1);
    const snapshot = await readSnapshot(path);

    expect(snapshot.id).toBe('k8s-dsl-v1');
    expect(snapshot.axes).toHaveLength(5);
    expect(snapshot.composites).toHaveLength(2);
    expect(snapshot.axes[0].id).toBe('k8s_cluster');
    expect(snapshot.composites[0].dims).toHaveLength(4);
  });

  it('snapshot-io: 디렉토리 내 .json만 읽고 다른 파일은 무시한다', async () => {
    const dir = join(tmpRoot, 'mixed');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'a.json'), JSON.stringify(GIT_DSL_V1));
    await writeFile(join(dir, 'b.json'), JSON.stringify(K8S_DSL_V1));
    await writeFile(join(dir, 'notes.md'), '이건 무시');
    await writeFile(join(dir, 'data.txt'), '이것도 무시');

    const snapshots = await readSnapshots(dir);
    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((s) => s.id).toSorted()).toEqual(['git-dsl-v1', 'k8s-dsl-v1']);
  });
});

// ═══════════════════════════════════════════════════════
// S6. 에러 시나리오
// ═══════════════════════════════════════════════════════

describe('[S6] 에러 시나리오', () => {
  it('Catalog 형식이 아닌 JSON → loadCatalog 에러', async () => {
    const bad = join(tmpRoot, 'bad.json');
    await writeFile(bad, JSON.stringify({ axes: [], composites: [] }));

    await expect(codegen({ catalog: bad, output: join(tmpRoot, 'out') })).rejects.toThrow();
  });

  it('axes 없는 JSON → loadCatalog 에러', async () => {
    const bad = join(tmpRoot, 'bad2.json');
    await writeFile(bad, JSON.stringify({ id: 'x', composites: [] }));

    await expect(codegen({ catalog: bad, output: join(tmpRoot, 'out') })).rejects.toThrow();
  });

  it('존재하지 않는 catalog 경로 → 에러', async () => {
    await expect(
      codegen({ catalog: '/tmp/nonexistent-file-xyz.json', output: join(tmpRoot, 'out') }),
    ).rejects.toThrow();
  });

  it('최소 Catalog → SDK 파일 생성 (에러 아님)', async () => {
    const output = join(tmpRoot, 'out');
    // 빈 축/prefix를 가진 최소 Catalog
    const minimalCatalog: Catalog = { id: 'empty', name: 'empty', axes: {}, prefixes: {} };

    await codegen({ loadedCatalog: minimalCatalog, output });

    // SDK 파일이 생성된다 (빈 Catalog도 유효)
    const files = await readdir(output);
    expect(files.length).toBeGreaterThan(0);
  });

  it('잘못된 JSON → 파싱 에러', async () => {
    const bad = join(tmpRoot, 'invalid.json');
    await writeFile(bad, '{ not valid json }}}');

    await expect(codegen({ catalog: bad, output: join(tmpRoot, 'out') })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════
// S7. 코어 타입 정합성
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// S8. 53비트 안전 범위 검증
// ═══════════════════════════════════════════════════════

describe('[S8] 53비트 안전 범위 — capacity product 검증 (version-as-axis 반영)', () => {
  // schema_version 축 capacity=32가 모든 composite의 첫 번째 차원에 추가됨

  it('Git DSL composite capacity (schema_version 포함)', () => {
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

  it('K8s DSL composite capacity (schema_version 포함)', () => {
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

  it('APM K8s Signal cross-domain composite (schema_version 내포)', () => {
    // apm_k8s_signal: k8s_workload_addr(268,435,456) × signal_type(8) × severity(8)
    // schema_version이 k8s_workload_addr에 내포됨
    const product = 268_435_456 * 8 * 8;
    expect(product).toBe(17_179_869_184);
    expect(Math.ceil(Math.log2(product))).toBe(34);
    expect(product).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});
