// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk scan git — 모노레포의 git 상태를 SchemaSnapshot으로 추출.
 *
 * ── 원리 ──
 * git repo의 메타데이터(패키지, 버전, 커밋 타입, 아키텍처 분류)를
 * n차원 좌표 공간의 축으로 변환한다.
 *
 * 이 SchemaSnapshot은 하나의 atomic module이다:
 * - DSL의 축들이 교차하여 특정 기능/개념 단위를 기술
 * - NestJS의 모듈이 export하는 서비스 단위에 대응
 * - 기존 codegen/schema push 파이프라인과 호환
 *
 * ── 축 (axes) ──
 *   pkg      패키지 식별자 (packages/*)
 *   semver   시맨틱 버전 (git tag + package.json)
 *   cc_type  conventional commit 타입
 *   tier     아키텍처 계층 (foundation/kernel/logic/bridge/consumer)
 *   runtime  실행 환경 (library/server/browser)
 *   scope    npm 공개 범위 (public/private)
 *
 * ── 복합 인덱스 (composites) ──
 *   pkg_version  pkg × semver       → 릴리즈 주소
 *   change_map   pkg × semver × cc  → 변경 추적 주소
 *   commit_addr  cc_type × pkg      → 커밋 패턴 주소
 *   pkg_class    pkg × tier × runtime → 패키지 분류 주소
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SchemaSnapshot, Axis, Composite } from "codegen-core";
import { scanAndClassify } from "package-classifier";
import {
  getRepoName,
  listSemverTags,
  collectCommitTypes,
  commitCountsByScope,
} from "git-utils";

// ── Options ──────────────────────────────────────────

export interface GitScanOptions {
  root: string;
  output: string;
  id?: string;
}

// ── Capacity 계산 ────────────────────────────────────

/** entries 수에 맞는 capacity (최소 headroom 보장) */
function capacityFor(count: number, minHeadroom = 2): number {
  const target = count + minHeadroom;
  let p = 2;
  while (p < target) p *= 2;
  return p;
}

// ── Main ─────────────────────────────────────────────

export async function gitScan(opts: GitScanOptions): Promise<void> {
  const root = resolve(opts.root);
  const repoName = opts.id ?? getRepoName(root);

  console.log(`Scanning: ${root}`);

  // 1. 패키지 스캔 + 분류
  const packages = await scanAndClassify(root);
  if (packages.length === 0) {
    throw new Error("패키지를 찾을 수 없음 — packages/ 디렉토리 확인");
  }
  console.log(`  packages: ${packages.length}`);

  // 2. 버전 수집 (git tag + package.json)
  const tags = listSemverTags(root);
  const versions = [
    ...new Set([...tags, ...packages.map((p) => p.version)]),
  ].toSorted();
  console.log(`  versions: ${versions.length} (${versions.join(", ")})`);

  // 3. 커밋 타입 수집
  const ccTypes = collectCommitTypes(root);
  console.log(`  cc_types: ${ccTypes.length} (${ccTypes.join(", ")})`);

  // 4. 분류값 수집
  const tiers = [...new Set(packages.map((p) => p.tier))].toSorted();
  const runtimes = [...new Set(packages.map((p) => p.runtime))].toSorted();
  const scopes: string[] = ["public", "private"];

  // 5. 축 구성
  const axes: Axis[] = [
    {
      id: "pkg",
      entries: packages.map((p) => p.displayName),
      capacity: capacityFor(packages.length),
    },
    {
      id: "semver",
      entries: versions,
      // semver는 빈번히 증가 → 넉넉한 headroom
      capacity: Math.max(16, capacityFor(versions.length, 8)),
    },
    {
      id: "cc_type",
      entries: ccTypes,
      capacity: capacityFor(ccTypes.length),
    },
    {
      id: "tier",
      entries: tiers,
      capacity: capacityFor(tiers.length),
    },
    {
      id: "runtime",
      entries: runtimes,
      capacity: capacityFor(runtimes.length),
    },
    {
      id: "scope",
      entries: scopes,
      capacity: 2,
    },
  ];

  // 6. 복합 인덱스 — 축 배치 순서는 stride 안정성 기준
  //    (변경 빈도 높은 축 → 앞, 낮은 축 → 뒤)
  const composites: Composite[] = [
    { id: "pkg_version", dims: ["pkg", "semver"], owner: repoName },
    { id: "change_map", dims: ["pkg", "semver", "cc_type"], owner: repoName },
    { id: "commit_addr", dims: ["cc_type", "pkg"], owner: repoName },
    { id: "pkg_class", dims: ["pkg", "tier", "runtime"], owner: repoName },
  ];

  // 7. SchemaSnapshot 출력
  const snapshot: SchemaSnapshot = {
    id: `${repoName}-git`,
    axes,
    composites,
  };

  await mkdir(opts.output, { recursive: true });
  const outPath = join(opts.output, `${snapshot.id}.json`);
  await writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(`\nSchema → ${outPath}`);

  // 8. 부가 메타데이터 (deps, commit counts) — 별도 파일
  const meta = {
    schemaId: snapshot.id,
    scannedAt: new Date().toISOString(),
    packages: packages.map((p) => ({
      name: p.displayName,
      version: p.version,
      tier: p.tier,
      runtime: p.runtime,
      scope: p.scope,
      deps: p.deps,
    })),
    commitCounts: commitCountsByScope(root),
  };

  const metaPath = join(opts.output, `${snapshot.id}.meta.json`);
  await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  console.log(`Meta  → ${metaPath}`);
}
