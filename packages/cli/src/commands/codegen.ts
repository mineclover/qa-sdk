// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { writeOutput } from 'snapshot-io';
import { generateCatalogTypes, generateDataObjectBindings, testMigration } from 'codegen-core';
import { loadCatalog, isDkgConfig, loadDkgConfig } from 'config-loader';
import {
  latestPrefixVersion,
  type Catalog,
  type DkgConfig,
  type DataObjectBinding,
} from '@qa-sdk/core';
import {
  createProgrammingArtifactRegistryRecord,
  type ProgrammingArtifactRegistryRecord,
} from 'operational-ontology/programming-artifacts';
import { appendProgrammingArtifactRegistryRecords } from '../lib/programming-artifact-registry.js';

/** 공통 codegen 옵션 */
interface CodegenBase {
  output: string;
  dkgConfig?: string;
  lockVersion?: string;
  artifactRegistry?: string;
  ownerDefinitionId?: string;
}

/** Registry에서 카탈로그 fetch → 생성 */
export interface CodegenRegistryOptions extends CodegenBase {
  registry: string;
  catalogId?: string;
}

/** 로컬 Catalog → 생성 */
export interface CodegenCatalogOptions extends CodegenBase {
  catalog?: string;
  loadedCatalog?: Catalog;
}

export type CodegenOptions = CodegenRegistryOptions | CodegenCatalogOptions;

function isRegistryOptions(opts: CodegenOptions): opts is CodegenRegistryOptions {
  return 'registry' in opts && !!opts.registry;
}

export async function codegen(opts: CodegenOptions): Promise<void> {
  if (isRegistryOptions(opts)) {
    return codegenFromRegistry(opts);
  }
  return codegenFromCatalog(opts);
}

// ── Registry 기반 codegen ──────────────────────────────

async function codegenFromRegistry(opts: CodegenRegistryOptions): Promise<void> {
  const registryUrl = opts.registry;
  const catalogId = opts.catalogId ?? 'demo';

  console.log(`Fetching catalog "${catalogId}" from ${registryUrl}...`);

  let catalog: Catalog;
  let fromRegistry = false;

  try {
    const res = await fetch(`${registryUrl}/catalogs/${catalogId}`);
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { id: string; name: string; data: string };
    catalog = JSON.parse(body.data) as Catalog;
    fromRegistry = true;
    console.log(
      `Catalog loaded: "${catalog.id}" (${Object.keys(catalog.prefixes).length} prefixes, ${Object.keys(catalog.axes).length} axes)`,
    );
  } catch (err) {
    console.warn(`Registry fetch failed: ${(err as Error).message}`);
    console.warn('Falling back to local catalog...');
    try {
      catalog = (await loadCatalog()) as Catalog;
    } catch {
      // TS config 로드 실패 시 DEMO_CATALOG 최종 fallback
      const { DEMO_CATALOG } = await import('demo-snapshot');
      catalog = DEMO_CATALOG as Catalog;
    }
    console.log(
      `Local fallback: "${catalog.id}" (${Object.keys(catalog.prefixes).length} prefixes)`,
    );
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
        const configBody = (await configRes.json()) as { catalogId: string; data: string };
        const parsed = JSON.parse(configBody.data) as unknown;
        if (isDkgConfig(parsed)) {
          dkgConfig = parsed;
          console.log(`DkgConfig loaded from registry (${catalogId})`);
        } else {
          console.warn(`Registry DkgConfig 형식 불일치: ${catalogId}`);
        }
      }
    } catch {
      /* registry에 config 없으면 로컬 fallback */
    }
    if (!dkgConfig) {
      dkgConfig = (await loadDkgConfig()) ?? undefined;
      if (dkgConfig) console.log('DkgConfig: local fallback');
    }
  }

  const result = await generateCatalogTypes(catalog, dkgConfig ?? undefined, {
    lockVersion: opts.lockVersion,
  });

  await mkdir(opts.output, { recursive: true });

  for (const file of result.files) {
    const outPath = join(opts.output, file.path);
    await writeOutput(outPath, file.content);
    console.log(`Generated → ${outPath}`);
  }

  await maybeWriteCodegenArtifactRegistryRecords({
    artifactRegistry: opts.artifactRegistry,
    outputDir: opts.output,
    files: result.files.map((file) => file.path),
    producedByRef: `qa-sdk codegen --registry ${registryUrl} --catalog-id ${catalogId}`,
    derivedFromRefs: [
      `registry:${registryUrl}/catalogs/${catalogId}`,
      opts.dkgConfig,
      opts.lockVersion ? `prefix-version-lock:${opts.lockVersion}` : undefined,
    ],
    ownerDefinitionId: opts.ownerDefinitionId ?? 'codegen-schema-output',
    materializesOutputRefs: ['apm-codegen-system', 'codegen-schema-output'],
    verificationRefs: ['packages/cli/src/commands/codegen.test.ts'],
    metadata: {
      catalogId: catalog.id,
      contentHash: result.contentHash,
      catalogDigest: result.catalogDigest,
      sourceDigest: result.sourceDigest,
      source: fromRegistry ? 'registry' : 'local-fallback',
    },
  });

  console.log(
    `${result.files.length} file(s) generated from registry "${registryUrl}" catalog "${catalog.id}" (hash: ${result.contentHash})`,
  );
}

// ── Catalog 기반 codegen ───────────────────────────────

async function codegenFromCatalog(opts: CodegenCatalogOptions): Promise<void> {
  const catalog = (opts.loadedCatalog ?? (await loadCatalog(opts.catalog))) as Catalog;
  const dkgConfig = opts.dkgConfig ? await loadDkgConfig(opts.dkgConfig) : await loadDkgConfig();

  const result = await generateCatalogTypes(catalog, dkgConfig ?? undefined, {
    lockVersion: opts.lockVersion,
  });

  await mkdir(opts.output, { recursive: true });

  for (const file of result.files) {
    const outPath = join(opts.output, file.path);
    await writeOutput(outPath, file.content);
    console.log(`Generated → ${outPath}`);
  }

  await maybeWriteCodegenArtifactRegistryRecords({
    artifactRegistry: opts.artifactRegistry,
    outputDir: opts.output,
    files: result.files.map((file) => file.path),
    producedByRef: 'qa-sdk codegen',
    derivedFromRefs: [
      opts.catalog,
      `catalog:${catalog.id}`,
      opts.dkgConfig,
      opts.lockVersion ? `prefix-version-lock:${opts.lockVersion}` : undefined,
    ],
    ownerDefinitionId: opts.ownerDefinitionId ?? 'codegen-schema-output',
    materializesOutputRefs: ['apm-codegen-system', 'codegen-schema-output'],
    verificationRefs: ['packages/cli/src/commands/codegen.test.ts'],
    metadata: {
      catalogId: catalog.id,
      contentHash: result.contentHash,
      catalogDigest: result.catalogDigest,
      sourceDigest: result.sourceDigest,
      source: opts.catalog ? 'catalog-file' : 'loaded-catalog',
    },
  });

  console.log(
    `${result.files.length} file(s) generated from catalog "${catalog.id}" (hash: ${result.contentHash})`,
  );
  if (opts.lockVersion) {
    console.log(`  version locked to: ${opts.lockVersion}`);
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
      const versions = (await res.json()) as Array<{ versionId: string; status: string }>;
      if (versions.length === 0) continue;

      const targetVersion = lockVersion ?? latestPrefixVersion(catalog, prefixId);
      const matched = versions.find((v) => v.versionId === targetVersion);

      if (matched) {
        if (matched.status === 'deprecated') {
          warnings.push(`⚠ ${prefixId}:${targetVersion} is deprecated`);
        } else if (matched.status === 'draft') {
          warnings.push(`⚠ ${prefixId}:${targetVersion} is still draft (not released)`);
        }
      }
    } catch {
      /* 개별 prefix 검증 실패는 무시 */
    }
  }

  if (warnings.length > 0) {
    console.warn('\nVersion lifecycle warnings:');
    for (const w of warnings) console.warn(`  ${w}`);
    console.warn('');
  }
}

// ── DataObject Bindings codegen ──────────────────────

export interface DataObjectCodegenCliOptions {
  /** DataObjectBinding[] JSON 파일 경로 */
  bindingsPath: string;
  /** 출력 디렉토리 */
  output: string;
  artifactRegistry?: string;
  ownerDefinitionId?: string;
}

/**
 * DataObjectBinding JSON → Typed SDK 파일 생성.
 *
 * qa-sdk codegen --data-objects ./bindings.json --output ./generated
 */
export async function codegenDataObjects(opts: DataObjectCodegenCliOptions): Promise<void> {
  const raw = await readFile(opts.bindingsPath, 'utf-8');
  const bindings = JSON.parse(raw) as DataObjectBinding[];

  if (!Array.isArray(bindings) || bindings.length === 0) {
    console.error('바인딩 파일이 비어있거나 배열이 아닙니다:', opts.bindingsPath);
    return;
  }

  console.log(`DataObject bindings: ${bindings.length}건 (${opts.bindingsPath})`);

  const result = generateDataObjectBindings(bindings);

  await mkdir(opts.output, { recursive: true });

  for (const file of result.files) {
    const outPath = join(opts.output, file.path);
    await writeOutput(outPath, file.content);
    console.log(`Generated → ${outPath}`);
  }

  await maybeWriteCodegenArtifactRegistryRecords({
    artifactRegistry: opts.artifactRegistry,
    outputDir: opts.output,
    files: result.files.map((file) => file.path),
    producedByRef: `qa-sdk codegen --data-objects ${opts.bindingsPath}`,
    derivedFromRefs: [opts.bindingsPath],
    ownerDefinitionId: opts.ownerDefinitionId ?? 'data-object-codegen',
    materializesOutputRefs: ['data-object-codegen'],
    verificationRefs: ['packages/cli/src/commands/codegen.test.ts'],
    metadata: {
      bindingCount: bindings.length,
      contentHash: result.contentHash,
      source: 'data-object-bindings',
    },
  });

  console.log(`${result.files.length} file(s) generated (hash: ${result.contentHash})`);
}

interface CodegenArtifactRegistryWriteInput {
  artifactRegistry?: string;
  outputDir: string;
  files: readonly string[];
  producedByRef: string;
  derivedFromRefs: readonly (string | undefined)[];
  ownerDefinitionId: string;
  materializesOutputRefs: readonly string[];
  verificationRefs: readonly string[];
  metadata: Record<string, unknown>;
}

async function maybeWriteCodegenArtifactRegistryRecords(
  input: CodegenArtifactRegistryWriteInput,
): Promise<void> {
  if (!input.artifactRegistry) return;

  const now = new Date().toISOString();
  const records: ProgrammingArtifactRegistryRecord[] = input.files.map((filePath) => {
    const outputPath = portablePath(join(input.outputDir, filePath));
    return createProgrammingArtifactRegistryRecord({
      kind: 'generated-source',
      artifactRef: outputPath,
      outputPath,
      producedByRef: input.producedByRef,
      derivedFromRefs: input.derivedFromRefs,
      ownerDefinitionId: input.ownerDefinitionId,
      materializesOutputRefs: input.materializesOutputRefs,
      sourceRefs: input.derivedFromRefs,
      verificationRefs: input.verificationRefs,
      createdAt: now,
      metadata: {
        ...input.metadata,
        generatedPath: filePath,
      },
    });
  });

  await appendProgrammingArtifactRegistryRecords(input.artifactRegistry, records);
  console.log(
    `artifact registry: ${records.length} generated-source record(s) -> ${input.artifactRegistry}`,
  );
}

function portablePath(filePath: string): string {
  const resolved = resolve(filePath);
  const rel = relative(process.cwd(), resolved);
  if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel;
  return filePath;
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
  const catalog = (opts.loadedCatalog ?? (await loadCatalog(opts.catalog))) as Catalog;

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
