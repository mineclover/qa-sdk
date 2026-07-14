import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { OperationalOntologyPack } from 'operational-ontology/pack';

import {
  collectDocsReadiness,
  emptyDocsReadiness,
  type OntologyPackDocsFamilyReader,
} from './internal/docs-readiness.js';
import { collectFileReadiness, emptyFileReadiness } from './internal/file-readiness.js';
import { loadOntologyPack } from './internal/load-pack.js';
import { validateOntologyPackRuntime } from './internal/runtime-validation.js';
import type {
  OntologyPackValidateIssue,
  OntologyPackValidateReadiness,
  OntologyPackValidateResolution,
  OntologyPackValidateRuntimeSummary,
} from './internal/types.js';
export type {
  OntologyPackValidateIssue,
  OntologyPackValidateIssueLevel,
  OntologyPackValidateIssueSource,
  OntologyPackValidateDocsReadiness,
  OntologyPackValidateFileReadiness,
  OntologyPackValidateFileRef,
  OntologyPackValidateReadiness,
  OntologyPackValidateResolution,
  OntologyPackValidateRuntimeSummary,
  OntologyPackValidateSourceMapReadiness,
} from './internal/types.js';

// ─── Known pack registry ────────────────────────────────
export {
  isKnownOntologyPackId,
  KNOWN_ONTOLOGY_PACK_IDS,
  resolveKnownOntologyPack,
} from './known-ontology-packs.js';

export type {
  KnownOntologyPackId,
  KnownOntologyPackResolution,
  ResolveKnownOntologyPackResult,
  UnknownOntologyPackError,
  UnknownOntologyPackResolution,
} from './known-ontology-packs.js';

// ─── Docs-family reader injection point ─────────────────
export type { OntologyPackDocsFamilyReader } from './internal/docs-readiness.js';
export { filterMatchingDocsForPack } from './internal/docs-readiness.js';

export interface OntologyPackValidateIdentitySummary {
  readonly packId: string | null;
  readonly schemaPresent: boolean;
  readonly metadataKeys: readonly string[];
}

export interface OntologyPackValidateComponentSchemaSummary {
  readonly axes: readonly string[];
  readonly taxonomies: readonly string[];
  readonly relationCategories: readonly string[];
  readonly traversals: readonly string[];
  readonly counts: {
    readonly axes: number;
    readonly taxonomies: number;
    readonly relationCategories: number;
    readonly traversals: number;
  };
}

export interface OntologyPackValidateSystemBindingSummary {
  readonly blueprints: readonly {
    readonly blueprintId: string;
    readonly coordinateRef: string;
    readonly unitKind: string;
    readonly requiredSchemas: readonly string[];
    readonly implementationRefs: readonly string[];
    readonly verificationRefs: readonly string[];
  }[];
  readonly counts: {
    readonly blueprints: number;
    readonly implementationRefs: number;
    readonly verificationRefs: number;
  };
}

export interface OntologyPackValidateResult {
  readonly valid: boolean;
  readonly packRef: string;
  readonly packId: string | null;
  readonly resolution: OntologyPackValidateResolution;
  readonly issues: readonly OntologyPackValidateIssue[];
  readonly identity: OntologyPackValidateIdentitySummary;
  readonly componentSchema: OntologyPackValidateComponentSchemaSummary;
  readonly systemBindings: OntologyPackValidateSystemBindingSummary;
  readonly readiness: OntologyPackValidateReadiness;
  readonly runtime: OntologyPackValidateRuntimeSummary;
}

export interface ValidateOntologyPackInput {
  readonly packRef: string;
  readonly rootDir?: string;
  /**
   * Reader for the docs family associated with a pack. When omitted, docs
   * readiness is reported as empty — consumers that need docs-backed readiness
   * must inject a reader (typically via the definition-markdown adapter in the
   * qa-sdk CLI).
   */
  readonly readDocsFamily?: OntologyPackDocsFamilyReader;
}

export async function validateOntologyPackFromRef(
  input: ValidateOntologyPackInput,
): Promise<OntologyPackValidateResult> {
  const invocationDir = resolve(input.rootDir ?? process.cwd());
  const rootDir = findWorkspaceRoot(invocationDir);
  const loaded = await loadOntologyPack(input.packRef, rootDir, invocationDir);
  const pack = loaded.pack;
  const runtimeValidation = pack
    ? validateOntologyPackRuntime(pack)
    : { issues: [], summary: { valid: true, issueCount: 0 } };
  const fileReadiness = pack ? await collectFileReadiness({ pack, rootDir }) : emptyFileReadiness();
  const docsReadiness = pack
    ? await collectDocsReadiness({
        packId: pack.packId,
        rootDir,
        fileRefs: fileReadiness.fileRefs,
        ...(input.readDocsFamily ? { readDocsFamily: input.readDocsFamily } : {}),
      })
    : emptyDocsReadiness(null);
  // readDocsFamily 미주입 시 docs status가 skipped로 조용히 넘어가지 않도록
  // warning surface (silent skip 방지). 의도적 skip이면 caller가 warning을 무시.
  const readerNotInjectedIssues: OntologyPackValidateIssue[] =
    pack && !input.readDocsFamily
      ? [
          {
            level: 'warning',
            source: 'docs',
            path: 'readiness.docs',
            code: 'docs-reader-not-injected',
            message:
              'Docs readiness skipped: no readDocsFamily reader injected. Inject a reader to include docs family coverage.',
          },
        ]
      : [];
  const issues = [
    ...loaded.issues,
    ...runtimeValidation.issues,
    ...fileReadiness.issues,
    ...docsReadiness.issues,
    ...readerNotInjectedIssues,
  ];

  return {
    valid: issues.every((issue) => issue.level !== 'error'),
    packRef: input.packRef,
    packId: pack?.packId ?? null,
    resolution: loaded.resolution,
    issues,
    identity: summarizeIdentity(pack),
    componentSchema: summarizeComponentSchema(pack),
    systemBindings: summarizeSystemBindings(pack),
    readiness: {
      implementationFiles: fileReadiness.implementationFiles,
      testFiles: fileReadiness.testFiles,
      docs: docsReadiness.docs,
      sourceMap: docsReadiness.sourceMap,
    },
    runtime: runtimeValidation.summary,
  };
}

function summarizeIdentity(
  pack: OperationalOntologyPack | null,
): OntologyPackValidateIdentitySummary {
  return {
    packId: typeof pack?.packId === 'string' ? pack.packId : null,
    schemaPresent: Boolean(pack?.schema),
    metadataKeys: Object.keys(pack?.metadata ?? {}).toSorted(),
  };
}

function summarizeComponentSchema(
  pack: OperationalOntologyPack | null,
): OntologyPackValidateComponentSchemaSummary {
  const axes = pack?.schema?.axes?.map((axis) => axis.id).toSorted() ?? [];
  const taxonomies = pack?.schema?.taxonomies?.map((taxonomy) => taxonomy.id).toSorted() ?? [];
  const relationCategories =
    pack?.schema?.relationCategories?.map((category) => category.category).toSorted() ?? [];
  const traversals =
    pack?.schema?.traversals?.map((traversal) => traversal.purpose).toSorted() ?? [];

  return {
    axes,
    taxonomies,
    relationCategories,
    traversals,
    counts: {
      axes: axes.length,
      taxonomies: taxonomies.length,
      relationCategories: relationCategories.length,
      traversals: traversals.length,
    },
  };
}

function summarizeSystemBindings(
  pack: OperationalOntologyPack | null,
): OntologyPackValidateSystemBindingSummary {
  const blueprints = (pack?.blueprints ?? [])
    .map((blueprint) => ({
      blueprintId: blueprint.blueprintId,
      coordinateRef: blueprint.coordinateRef,
      unitKind: blueprint.unitKind,
      requiredSchemas: [...(blueprint.requiredSchemas ?? [])].toSorted(),
      implementationRefs: (blueprint.implementationBinding?.implementationRefs ?? [])
        .map((ref) => ref.ref)
        .toSorted(),
      verificationRefs: (blueprint.verificationBinding?.verificationRefs ?? [])
        .map((ref) => ref.ref)
        .toSorted(),
    }))
    .toSorted((left, right) => left.blueprintId.localeCompare(right.blueprintId));
  return {
    blueprints,
    counts: {
      blueprints: blueprints.length,
      implementationRefs: blueprints.reduce(
        (count, blueprint) => count + blueprint.implementationRefs.length,
        0,
      ),
      verificationRefs: blueprints.reduce(
        (count, blueprint) => count + blueprint.verificationRefs.length,
        0,
      ),
    },
  };
}

function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml')) && existsSync(join(current, 'docs'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return resolve(startDir);
    current = parent;
  }
}
