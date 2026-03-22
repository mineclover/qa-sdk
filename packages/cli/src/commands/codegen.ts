import { stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SchemaSnapshot } from "../lib/types.js";
import { readSnapshot, readSnapshots, writeOutput } from "../lib/snapshot-io.js";
import { generateProto, type ProtoGenOptions } from "../generators/proto.js";
import { generateTypescript } from "../generators/typescript.js";
import { generateCatalogTypes } from "../generators/catalog-typescript.js";
import { loadCatalog } from "../catalog-loader.js";
import { loadDkgConfig } from "../dkg-config-loader.js";
import type { Catalog, DkgConfig } from "@qa-sdk/core";

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
    catalog = await loadCatalog() as Catalog;
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
        dkgConfig = JSON.parse(configBody.data) as DkgConfig;
        console.log(`DkgConfig loaded from registry (${catalogId})`);
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
