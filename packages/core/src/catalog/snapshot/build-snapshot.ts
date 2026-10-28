// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { Catalog, PrefixDef, PrefixVersionDef } from '../catalog.types.js';
import { getPrefixEntries, getPrefixShape } from '../runtime.js';
import {
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  LEGACY_V1_CODEC,
  prefixLayoutKey,
  type BuildCatalogSnapshotOptions,
  type CatalogSnapshotBuildResult,
  type DimensionLayout,
  type PrefixLayout,
  type PrefixLayoutKey,
  type SnapshotLayoutIssue,
} from './catalog-snapshot.types.js';
import { CATALOG_DIGEST_ALGORITHM, computeCatalogDigest, digestCanonical } from './digest.js';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Catalog → 불변 CatalogSnapshot.
 * shape·entries는 canonical runtime(getPrefixShape/getPrefixEntries)에서 파생한다.
 */
export async function buildCatalogSnapshot(
  catalog: Catalog,
  options: BuildCatalogSnapshotOptions,
): Promise<CatalogSnapshotBuildResult> {
  if (!Number.isSafeInteger(options.snapshotVersion) || options.snapshotVersion < 1) {
    throw new RangeError(`snapshotVersion은 1 이상의 정수여야 합니다: ${options.snapshotVersion}`);
  }

  const layouts: Record<PrefixLayoutKey, PrefixLayout> = {};
  const issues: SnapshotLayoutIssue[] = [];

  for (const prefixId of Object.keys(catalog.prefixes).sort()) {
    const prefix = catalog.prefixes[prefixId];
    for (const versionDef of prefix.versions) {
      const key = prefixLayoutKey(prefixId, versionDef.version);
      try {
        layouts[key] = await buildPrefixLayout(catalog, prefix, versionDef);
      } catch (error) {
        issues.push({ key, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return {
    snapshot: {
      catalogId: catalog.id,
      snapshotVersion: options.snapshotVersion,
      digest: await computeCatalogDigest(catalog),
      codecVersion: options.codecVersion ?? LEGACY_V1_CODEC,
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      digestAlgorithm: CATALOG_DIGEST_ALGORITHM,
      parentDigest: options.parentDigest,
      layouts,
    },
    issues,
  };
}

async function buildPrefixLayout(
  catalog: Catalog,
  prefix: PrefixDef,
  versionDef: PrefixVersionDef,
): Promise<PrefixLayout> {
  const { dimCapacities } = getPrefixShape(catalog, prefix.id, versionDef.version);
  const { entries } = getPrefixEntries(catalog, prefix.id, versionDef.version);

  const dims: DimensionLayout[] = [];
  for (const label of versionDef.labels ?? prefix.labels) {
    const dim = prefix.dims[label];
    if (dim.kind === 'table_ref') continue;
    const base = { label, capacity: dimCapacities[label], entries: entries[label] ?? [] };
    dims.push(
      dim.kind === 'axis'
        ? {
            ...base,
            kind: 'axis',
            sourceId: dim.axisId,
            sourceVersion: versionDef.axisVersions[label],
          }
        : {
            ...base,
            kind: 'prefix_ref',
            sourceId: dim.prefixId,
            sourceVersion: versionDef.refEntries?.[label]?.refVersion ?? null,
          },
    );
  }

  const strides = new Array<bigint>(dims.length);
  let totalSpace = 1n;
  for (let i = dims.length - 1; i >= 0; i--) {
    strides[i] = totalSpace;
    totalSpace *= BigInt(dims[i].capacity);
  }

  const addressModel = prefix.addressModel ?? 'product';
  return {
    prefixId: prefix.id,
    version: versionDef.version,
    addressModel,
    dims,
    strides: strides.map(String),
    totalSpace: String(totalSpace),
    safePrecision: totalSpace - 1n <= MAX_SAFE,
    layoutDigest: await digestCanonical({
      prefixId: prefix.id,
      version: versionDef.version,
      addressModel,
      dims,
    }),
  };
}
