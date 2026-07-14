// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';

/**
 * git-scan 통합 테스트.
 * 실제 이 모노레포를 대상으로 스캔하여 SchemaSnapshot 구조를 검증한다.
 */

// vitest는 packages/cli에서 실행됨 → 모노레포 루트는 2단계 상위
const MONO_ROOT = resolve(__dirname, '../../../..');

// ── lib 단위 테스트 ──────────────────────────────────

describe('lib/git', () => {
  it('getRepoName: 이 레포의 이름을 반환', async () => {
    const { getRepoName } = await import('../lib/git.js');
    const name = getRepoName(MONO_ROOT);
    expect(name).toBe('qa-sdk');
  });

  it('listSemverTags: semver 형식만 필터링', async () => {
    const { listSemverTags } = await import('../lib/git.js');
    const tags = listSemverTags(MONO_ROOT);
    for (const tag of tags) {
      expect(tag).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it('collectCommitTypes: 최소 표준 6개 타입 포함', async () => {
    const { collectCommitTypes } = await import('../lib/git.js');
    const types = collectCommitTypes(MONO_ROOT);
    for (const std of ['feat', 'fix', 'refactor', 'docs', 'test', 'chore']) {
      expect(types).toContain(std);
    }
  });
});

describe('package-classifier', () => {
  it('scanAndClassify: packages/ 디렉토리 스캔', async () => {
    const { scanAndClassify } = await import('package-classifier');
    const pkgs = await scanAndClassify(MONO_ROOT);

    expect(pkgs.length).toBeGreaterThan(0);

    // 알려진 패키지 존재 확인
    const names = pkgs.map((p) => p.displayName);
    expect(names).toContain('weighted-index');
    expect(names).toContain('core');
    expect(names).toContain('cli');

    // 분류 검증
    for (const p of pkgs) {
      expect(['foundation', 'kernel', 'logic', 'bridge', 'consumer']).toContain(p.tier);
      expect(['library', 'server', 'browser']).toContain(p.runtime);
      expect(['public', 'private']).toContain(p.scope);
    }
  });

  it('tier 분류: 패턴 기반 heuristic', async () => {
    const { scanAndClassify } = await import('package-classifier');
    const pkgs = await scanAndClassify(MONO_ROOT);
    const byName = new Map(pkgs.map((p) => [p.displayName, p]));

    // foundation: low-level libraries
    expect(byName.get('weighted-index')?.tier).toBe('foundation');

    // logic: decision/runtime engines
    expect(byName.get('decision-flow')?.tier).toBe('logic');

    // bridge: SDK/client/codec/helper surfaces
    expect(byName.get('sdk')?.tier).toBe('bridge');
    expect(byName.get('browser-codec')?.tier).toBe('bridge');

    // consumer: apps, services, and review/demo surfaces
    expect(byName.get('platform-demo')?.tier).toBe('consumer');
  });

  it('내부 의존 해석: weighted-index의 역참조', async () => {
    const { scanAndClassify } = await import('package-classifier');
    const pkgs = await scanAndClassify(MONO_ROOT);
    const byName = new Map(pkgs.map((p) => [p.displayName, p]));

    // bit-index → weighted-index 의존
    const bitIndex = byName.get('bit-index');
    if (bitIndex) {
      expect(bitIndex.deps).toContain('weighted-index');
    }
  });
});

// ── git-scan 통합 테스트 ─────────────────────────────

describe('gitScan', () => {
  it('이 모노레포 스캔 → SchemaSnapshot JSON 생성', async () => {
    const { readFile, rm, stat } = await import('node:fs/promises');
    const { gitScan } = await import('./git-scan.js');
    const tmpDir = resolve('./tmp-git-scan-test');

    try {
      await gitScan({
        root: MONO_ROOT,
        output: tmpDir,
        id: 'qa-sdk',
      });

      // SchemaSnapshot 파일 존재 확인
      const schemaPath = resolve(tmpDir, 'qa-sdk-git.json');
      const raw = await readFile(schemaPath, 'utf-8');
      const snapshot = JSON.parse(raw);

      // 구조 검증
      expect(snapshot.id).toBe('qa-sdk-git');
      expect(snapshot.axes).toBeInstanceOf(Array);
      expect(snapshot.composites).toBeInstanceOf(Array);

      // 축 검증
      const axisIds = snapshot.axes.map((a: { id: string }) => a.id);
      expect(axisIds).toContain('pkg');
      expect(axisIds).toContain('semver');
      expect(axisIds).toContain('cc_type');
      expect(axisIds).toContain('tier');
      expect(axisIds).toContain('runtime');
      expect(axisIds).toContain('scope');

      // pkg 축: entries가 패키지 수와 일치
      const pkgAxis = snapshot.axes.find((a: { id: string }) => a.id === 'pkg');
      expect(pkgAxis.entries.length).toBeGreaterThan(0);
      expect(pkgAxis.entries).toContain('weighted-index');
      expect(pkgAxis.entries).toContain('core');

      // capacity는 entries 수 이상의 power of 2
      for (const axis of snapshot.axes) {
        expect(axis.capacity).toBeGreaterThanOrEqual(axis.entries.length);
        // power of 2 확인
        expect(axis.capacity & (axis.capacity - 1)).toBe(0);
      }

      // composite 검증
      const compIds = snapshot.composites.map((c: { id: string }) => c.id);
      expect(compIds).toContain('pkg_version');
      expect(compIds).toContain('change_map');
      expect(compIds).toContain('commit_addr');
      expect(compIds).toContain('pkg_class');

      // composite dims가 유효한 축 ID를 참조
      const axisIdSet = new Set(axisIds);
      for (const comp of snapshot.composites) {
        for (const dim of comp.dims) {
          expect(axisIdSet.has(dim)).toBe(true);
        }
      }

      // meta 파일 존재 확인
      const metaPath = resolve(tmpDir, 'qa-sdk-git.meta.json');
      const metaRaw = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw);
      expect(meta.schemaId).toBe('qa-sdk-git');
      expect(meta.packages).toBeInstanceOf(Array);
      expect(meta.packages.length).toBeGreaterThan(0);

      // packages에 deps 정보 포함
      const wiPkg = meta.packages.find((p: { name: string }) => p.name === 'weighted-index');
      expect(wiPkg).toBeDefined();
      expect(wiPkg.tier).toBe('foundation');
      expect(wiPkg.scope).toBe('public');
    } finally {
      // cleanup
      try {
        await rm(tmpDir, { recursive: true });
      } catch {
        // ignore
      }
    }
  });

  // SchemaSnapshot 기반 codegen은 제거됨 — Catalog/Registry 기반으로 전환 (codegen.test.ts에서 커버)
});
