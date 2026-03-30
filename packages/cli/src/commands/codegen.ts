import { stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readSnapshot, readSnapshots, writeOutput } from "snapshot-io";
import { generateProto, type ProtoGenOptions, generateTypescript, generateCatalogTypes, testMigration, type SchemaSnapshot } from "codegen-core";
import { loadCatalog, isDkgConfig, loadDkgConfig } from "config-loader";
import { latestPrefixVersion, type Catalog, type DkgConfig } from "@qa-sdk/core";

export type CodegenFormat = "proto" | "ts";

export interface CodegenOptions {
  formats: CodegenFormat[];
  input: string;
  output: string;
  packageName?: string;
  /** Catalog 파일 경로 (TS/JS/JSON). */
  catalog?: string;
  /** 이미 로드된 Catalog 객체. catalog 경로보다 우선. */
  loadedCatalog?: Catalog;
  /** DkgConfig 파일 경로. */
  dkgConfig?: string;
  /** 특정 prefix version으로 고정. 미지정 시 latest. */
  lockVersion?: string;
  /** Registry URL. 원격 카탈로그 fetch. */
  registry?: string;
  /** Registry에서 가져올 catalog ID (default: "demo"). */
  catalogId?: string;
}

/**
 * 코드 생성.
 *
 * --registry 지정 시: Registry에서 카탈로그 fetch → Typed SDK 생성
 * --catalog 지정 시: 로컬 Catalog → Typed SDK 생성
 * --input 지정 시: SchemaSnapshot JSON → 단일 .d.ts/.proto 생성 (기존)
 */
export async function codegen(opts: CodegenOptions): Promise<void> {
  if (opts.registry) {
    return codegenFromRegistry(opts);
  }
  if (opts.catalog || opts.loadedCatalog) {
    return codegenFromCatalog(opts);
  }
  return codegenFromSnapshot(opts);
}

// ── Registry 기반 codegen ──────────────────────────────

async function codegenFromRegistry(opts: CodegenOptions): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- codegen()에서 opts.registry 존재 시에만 호출
  const registryUrl = opts.registry!;
  const catalogId = opts.catalogId ?? "demo";

  console.log(`Fetching catalog "${catalogId}" from ${registryUrl}...`);

  let catalog: Catalog;
  let fromRegistry = false;

  try {
    const res = await fetch(`${registryUrl}/catalogs/${catalogId}`);
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    const body = await res.json() as { id: string; name: string; data: string };
    catalog = JSON.parse(body.data) as Catalog;
    fromRegistry = true;
    console.log(`Catalog loaded: "${catalog.id}" (${Object.keys(catalog.prefixes).length} prefixes, ${Object.keys(catalog.axes).length} axes)`);
  } catch (err) {
    console.warn(`Registry fetch failed: ${(err as Error).message}`);
    console.warn("Falling back to local catalog...");
    try {
      catalog = await loadCatalog() as Catalog;
    } catch {
      // TS config 로드 실패 시 DEMO_CATALOG 최종 fallback
      const { DEMO_CATALOG } = await import("demo-snapshot");
      catalog = DEMO_CATALOG as Catalog;
    }
    console.log(`Local fallback: "${catalog.id}" (${Object.keys(catalog.prefixes).length} prefixes)`);
  }

  // prefix version lifecycle 검증 (registry에서 로드한 경우)
  if (fromRegistry) {
    await validatePrefixVersions(registryUrl, catalog, opts.lockVersion);
  }

  // DkgConfig: --dkg-config → registry /catalogs/:id/config → 로컬 fallback
  let dkgConfig: DkgConfig | undefined;
  if (opts.dkgConfig) {
    dkgConfig = await loadDkgConfig(opts.dkgConfig);
  } else {
    try {
      const configRes = await fetch(`${registryUrl}/catalogs/${catalogId}/config`);
      if (configRes.ok) {
        const configBody = await configRes.json() as { catalogId: string; data: string };
        const parsed = JSON.parse(configBody.data) as unknown;
        if (isDkgConfig(parsed)) {
          dkgConfig = parsed;
          console.log(`DkgConfig loaded from registry (${catalogId})`);
        } else {
          console.warn(`Registry DkgConfig 형식 불일치: ${catalogId}`);
        }
      }
    } catch { /* registry에 config 없으면 로컬 fallback */ }
    if (!dkgConfig) {
      dkgConfig = await loadDkgConfig() ?? undefined;
      if (dkgConfig) console.log("DkgConfig: local fallback");
    }
  }

  const result = generateCatalogTypes(catalog, dkgConfig ?? undefined, {
    lockVersion: opts.lockVersion,
  });

  await mkdir(opts.output, { recursive: true });

  for (const file of result.files) {
    const outPath = join(opts.output, file.path);
    await writeOutput(outPath, file.content);
    console.log(`Generated → ${outPath}`);
  }

  console.log(`${result.files.length} file(s) generated from registry "${registryUrl}" catalog "${catalog.id}" (hash: ${result.contentHash})`);
}

// ── Catalog 기반 codegen ───────────────────────────────

async function codegenFromCatalog(opts: CodegenOptions): Promise<void> {
  const catalog = (opts.loadedCatalog ?? await loadCatalog(opts.catalog)) as Catalog;
  const dkgConfig = opts.dkgConfig ? await loadDkgConfig(opts.dkgConfig) : await loadDkgConfig();

  const result = generateCatalogTypes(catalog, dkgConfig ?? undefined, {
    lockVersion: opts.lockVersion,
  });

  await mkdir(opts.output, { recursive: true });

  for (const file of result.files) {
    const outPath = join(opts.output, file.path);
    await writeOutput(outPath, file.content);
    console.log(`Generated → ${outPath}`);
  }

  console.log(`${result.files.length} file(s) generated from catalog "${catalog.id}" (hash: ${result.contentHash})`);
  if (opts.lockVersion) {
    console.log(`  version locked to: ${opts.lockVersion}`);
  }
}

// ── SchemaSnapshot 기반 codegen (기존) ─────────────────

async function codegenFromSnapshot(opts: CodegenOptions): Promise<void> {
  const info = await stat(opts.input);
  const snapshots = info.isDirectory()
    ? await readSnapshots(opts.input)
    : [await readSnapshot(opts.input)];

  if (snapshots.length === 0) {
    console.log("입력 경로에 SchemaSnapshot JSON이 없음");
    return;
  }

  let generated = 0;

  for (const snapshot of snapshots) {
    const baseName = snapshot.id;

    for (const format of opts.formats) {
      const { content, ext } = generate(snapshot, format, {
        packageName: opts.packageName,
      });
      const outPath = join(opts.output, `${baseName}${ext}`);
      await writeOutput(outPath, content);
      console.log(`Generated → ${outPath}`);
      generated++;
    }
  }

  console.log(`${generated} file(s) generated`);
}

function generate(
  snapshot: SchemaSnapshot,
  format: CodegenFormat,
  protoOpts: ProtoGenOptions,
): { content: string; ext: string } {
  switch (format) {
    case "proto":
      return { content: generateProto(snapshot, protoOpts), ext: ".proto" };
    case "ts":
      return { content: generateTypescript(snapshot), ext: ".d.ts" };
  }
}

// ── Version Lifecycle 검증 ─────────────────────────────

/**
 * registry의 prefix version 상태를 검증.
 * deprecated/draft version 사용 시 경고.
 */
async function validatePrefixVersions(
  registryUrl: string,
  catalog: Catalog,
  lockVersion?: string,
): Promise<void> {
  const warnings: string[] = [];
  const prefixIds = Object.keys(catalog.prefixes).slice(0, 5); // 샘플 검증 (전수는 느림)

  for (const prefixId of prefixIds) {
    try {
      const res = await fetch(`${registryUrl}/prefixes/${prefixId}/versions`);
      if (!res.ok) continue;
      const versions = await res.json() as Array<{ versionId: string; status: string }>;
      if (versions.length === 0) continue;

      const targetVersion = lockVersion ?? latestPrefixVersion(catalog, prefixId);
      const matched = versions.find(v => v.versionId === targetVersion);

      if (matched) {
        if (matched.status === "deprecated") {
          warnings.push(`⚠ ${prefixId}:${targetVersion} is deprecated`);
        } else if (matched.status === "draft") {
          warnings.push(`⚠ ${prefixId}:${targetVersion} is still draft (not released)`);
        }
      }
    } catch { /* 개별 prefix 검증 실패는 무시 */ }
  }

  if (warnings.length > 0) {
    console.warn("\nVersion lifecycle warnings:");
    for (const w of warnings) console.warn(`  ${w}`);
    console.warn("");
  }
}

// ── Migration Test CLI ───────────────────────────────

/**
 * prefix의 multi-version 라운드트립을 CLI에서 실행.
 *
 * qa-sdk codegen --test-migration --prefix permission --from v1 --to v2
 */
export async function runMigrationTest(opts: {
  catalog?: string;
  loadedCatalog?: Catalog;
  prefix: string;
  from: string;
  to: string;
  samples?: number;
}): Promise<void> {
  const catalog = (opts.loadedCatalog ?? await loadCatalog(opts.catalog)) as Catalog;

  console.log(`\n══ Migration Test: ${opts.prefix} ${opts.from} → ${opts.to} ══\n`);

  const result = testMigration(catalog, opts.prefix, opts.from, opts.to, opts.samples);

  console.log(`  총 좌표: ${result.totalCoords}`);
  console.log(`  통과:    ${result.passed}`);
  console.log(`  실패:    ${result.failed}`);

  if (result.errors.length > 0) {
    console.log(`\n  실패 상세:`);
    for (const err of result.errors.slice(0, 5)) {
      console.log(`    coord=${JSON.stringify(err.coord)} → ${err.error}`);
    }
    if (result.errors.length > 5) {
      console.log(`    ... 외 ${result.errors.length - 5}건`);
    }
    process.exitCode = 1;
  } else {
    console.log(`\n  ✅ 모든 좌표 라운드트립 성공`);
  }
}
