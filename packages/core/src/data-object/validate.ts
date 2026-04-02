import type { Catalog, PathSegment, PrefixDef, PrefixVersionDef, TableSchema } from "../catalog/catalog.types.js";
import type { FieldLineage, FieldRef } from "../types/data-schema.js";
import { BindingRegistry } from "./registry.js";
import type { BindingValidation, ColumnAxisMapping, DataObjectBinding, LineageChainValidation } from "./types.js";

export function validateBindings(
  bindings: readonly DataObjectBinding[],
  catalog: Catalog,
): BindingValidation[] {
  const duplicateBindings = collectDuplicateBindings(bindings);

  return bindings.map((binding) => validateBinding(binding, catalog, duplicateBindings));
}

export function validateLineageChain(
  lineages: readonly FieldLineage[],
  registry: BindingRegistry,
): LineageChainValidation {
  const summary: LineageChainValidation = {
    bound: 0,
    unbound: 0,
    mismatched: 0,
  };

  for (const lineage of lineages) {
    const targetBinding = registry.getBySchema(lineage.target.schemaId);
    const sourceBindings = lineage.sources.map((source) => ({
      source,
      binding: registry.getBySchema(source.schemaId),
    }));

    if (!targetBinding || sourceBindings.some(({ binding }) => binding === null)) {
      summary.unbound += 1;
      continue;
    }

    if (hasLineageDimMismatch(lineage.target, targetBinding, sourceBindings)) {
      summary.mismatched += 1;
      continue;
    }

    summary.bound += 1;
  }

  return summary;
}

function validateBinding(
  binding: DataObjectBinding,
  catalog: Catalog,
  duplicateBindings: Map<string, DataObjectBinding[]>,
): BindingValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  validateIdentityColumn(binding, catalog.tables?.[binding.schemaId], errors, warnings);

  const prefix = catalog.prefixes[binding.prefixId];
  if (!prefix) {
    errors.push(`prefix "${binding.prefixId}" 없음`);
    return {
      schemaId: binding.schemaId,
      prefixId: binding.prefixId,
      errors,
      warnings,
    };
  }

  const versionDef = prefix.versions.find((version) => version.version === binding.prefixVersion);
  if (!versionDef) {
    errors.push(`prefix "${binding.prefixId}:${binding.prefixVersion}" 버전 없음`);
  }

  validateMappings(binding, prefix, versionDef, errors, warnings);
  validateDuplicateBinding(binding, duplicateBindings, errors);

  return {
    schemaId: binding.schemaId,
    prefixId: binding.prefixId,
    errors,
    warnings,
  };
}

function validateIdentityColumn(
  binding: DataObjectBinding,
  schemaTable: TableSchema | undefined,
  errors: string[],
  warnings: string[],
): void {
  if (!schemaTable) {
    warnings.push(`schema "${binding.schemaId}" table not found in catalog; identity 검증 생략`);
    return;
  }

  if (!Object.hasOwn(schemaTable.columns, "id")) {
    warnings.push(`schema "${binding.schemaId}"에 identity 후보 컬럼 "id" 없음; identity 검증 생략`);
    return;
  }

  if (!Object.hasOwn(binding.columnToAxis, "id")) {
    errors.push(`schema "${binding.schemaId}" identity 컬럼 "id"가 columnToAxis에 매핑되지 않음`);
  }
}

function validateMappings(
  binding: DataObjectBinding,
  prefix: PrefixDef,
  versionDef: PrefixVersionDef | undefined,
  errors: string[],
  warnings: string[],
): void {
  const dimLabels = new Set(Object.keys(prefix.dims));
  const addressModel = prefix.addressModel ?? "product";
  const segmentIds = new Set<string>();

  if (addressModel === "sum") {
    if (!versionDef?.segments || versionDef.segments.length === 0) {
      errors.push(`prefix "${binding.prefixId}:${binding.prefixVersion}" — addressModel:sum이지만 segments 없음`);
    } else {
      collectSegmentIds(versionDef.segments, segmentIds);
    }
  }

  for (const [columnId, mapping] of Object.entries(binding.columnToAxis)) {
    if (!dimLabels.has(mapping.dimLabel)) {
      errors.push(`column "${columnId}" → dim "${mapping.dimLabel}"이 prefix "${binding.prefixId}"에 없음`);
    }

    if (!mapping.segmentId) {
      continue;
    }

    if (addressModel !== "sum") {
      warnings.push(`column "${columnId}"의 segmentId "${mapping.segmentId}"는 product prefix에서 사용되지 않음`);
      continue;
    }

    if (!segmentIds.has(mapping.segmentId)) {
      errors.push(
        `column "${columnId}"의 segmentId "${mapping.segmentId}"가 prefix "${binding.prefixId}:${binding.prefixVersion}" segments에 없음`,
      );
    }
  }
}

function validateDuplicateBinding(
  binding: DataObjectBinding,
  duplicateBindings: Map<string, DataObjectBinding[]>,
  errors: string[],
): void {
  const key = bindingKey(binding);
  const duplicates = duplicateBindings.get(key);
  if (!duplicates || duplicates.length < 2) {
    return;
  }

  const schemaIds = duplicates.map((item) => item.schemaId).join(", ");
  errors.push(
    `prefix "${binding.prefixId}:${binding.prefixVersion}"에 중복 바인딩 존재: ${schemaIds}`,
  );
}

function collectDuplicateBindings(bindings: readonly DataObjectBinding[]): Map<string, DataObjectBinding[]> {
  const grouped = new Map<string, DataObjectBinding[]>();

  for (const binding of bindings) {
    const key = bindingKey(binding);
    const list = grouped.get(key) ?? [];
    list.push(binding);
    grouped.set(key, list);
  }

  return new Map(
    [...grouped.entries()].filter(([, list]) => list.length > 1),
  );
}

function bindingKey(binding: DataObjectBinding): string {
  return `${binding.prefixId}:${binding.prefixVersion}`;
}

function collectSegmentIds(segments: readonly PathSegment[], target: Set<string>): void {
  for (const segment of segments) {
    target.add(segment.segmentId);
    if (segment.children) {
      collectSegmentIds(segment.children, target);
    }
  }
}

function hasLineageDimMismatch(
  target: FieldRef,
  targetBinding: DataObjectBinding,
  sourceBindings: ReadonlyArray<{ source: FieldRef; binding: DataObjectBinding | null }>,
): boolean {
  const targetMapping = getColumnMapping(targetBinding, target.column);
  if (!targetMapping) {
    return false;
  }

  return !sourceBindings.some(({ source, binding }) => {
    if (!binding) {
      return false;
    }

    return mappingsMatch(
      targetMapping,
      getColumnMapping(binding, source.column),
    );
  });
}

function getColumnMapping(binding: DataObjectBinding, columnId: string): ColumnAxisMapping | null {
  return binding.columnToAxis[columnId] ?? null;
}

function mappingsMatch(expected: ColumnAxisMapping, actual: ColumnAxisMapping | null): boolean {
  if (!actual) {
    return false;
  }

  return expected.dimLabel === actual.dimLabel
    && normalizeSegmentId(expected.segmentId) === normalizeSegmentId(actual.segmentId);
}

function normalizeSegmentId(segmentId?: string): string {
  return segmentId ?? "";
}
