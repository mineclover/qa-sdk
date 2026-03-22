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
  /** Catalog 파일 경로 (TS/JS/JSON). 지정 시 Catalog 기반 codegen 실행. */
  catalog?: string;
  /** 이미 로드된 Catalog 객체. catalog 경로보다 우선. */
  loadedCatalog?: Catalog;
  /** DkgConfig 파일 경로. catalog과 함께 사용. */
  dkgConfig?: string;
}

/**
 * 코드 생성.
 *
 * --catalog 지정 시: Catalog + DkgConfig → Typed SDK 멀티 파일 생성
 * --input 지정 시: SchemaSnapshot JSON → 단일 .d.ts/.proto 생성 (기존 경로)
 */
export async function codegen(opts: CodegenOptions): Promise<void> {
  if (opts.catalog || opts.loadedCatalog) {
    return codegenFromCatalog(opts);
  }
  return codegenFromSnapshot(opts);
}

// ── Catalog 기반 codegen (신규) ────────────────────────

async function codegenFromCatalog(opts: CodegenOptions): Promise<void> {
  const catalog = (opts.loadedCatalog ?? await loadCatalog(opts.catalog)) as Catalog;
  const dkgConfig = opts.dkgConfig ? await loadDkgConfig(opts.dkgConfig) : await loadDkgConfig();

  const result = generateCatalogTypes(catalog, dkgConfig ?? undefined);

  await mkdir(opts.output, { recursive: true });

  for (const file of result.files) {
    const outPath = join(opts.output, file.path);
    await writeOutput(outPath, file.content);
    console.log(`Generated → ${outPath}`);
  }

  console.log(`${result.files.length} file(s) generated from catalog "${catalog.id}"`);
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
