import { createHash } from "node:crypto";
import type {
  AxisVersionSnapshot,
  Catalog,
  DataColumn,
  DataObjectBinding,
  DataSchema,
  PrefixDef,
  PrefixVersionDef,
} from "@qa-sdk/core";

export interface CodegenFile {
  readonly path: string;
  readonly content: string;
}

export interface CodegenResult {
  readonly files: readonly CodegenFile[];
  readonly contentHash: string;
}

interface BindingRecord {
  readonly binding: DataObjectBinding;
  readonly schema: DataSchema;
  readonly prefix: PrefixDef;
  readonly prefixVersion: PrefixVersionDef;
  readonly interfaceName: string;
  readonly boundTypeName: string;
  readonly bindingConstName: string;
}

interface LineagePair {
  readonly source: BindingRecord;
  readonly target: BindingRecord;
  readonly aliasName: string;
  readonly fields: readonly string[];
}

export function generateDataObjectBindings(
  catalog: Catalog,
  schemas: readonly DataSchema[],
  bindings: readonly DataObjectBinding[],
): CodegenResult {
  const contentHash = computeContentHash(catalog, schemas, bindings);
  const records = buildBindingRecords(catalog, schemas, bindings);

  const files: CodegenFile[] = [
    { path: "data-objects.ts", content: generateDataObjectsFile(catalog, contentHash, records) },
    { path: "binding-registry.ts", content: generateBindingRegistryFile(catalog.id, contentHash, records) },
    { path: "lineage-types.ts", content: generateLineageTypesFile(catalog.id, contentHash, records) },
    { path: "index.ts", content: generateIndexFile(catalog.id, contentHash) },
  ];

  return {
    files,
    contentHash,
  };
}

function computeContentHash(
  catalog: Catalog,
  schemas: readonly DataSchema[],
  bindings: readonly DataObjectBinding[],
): string {
  const normalized = {
    catalog: normalizeCatalog(catalog),
    schemas: normalizeSchemas(schemas),
    bindings: normalizeBindings(bindings),
  };

  return createHash("sha256")
    .update(stableStringify(normalized))
    .digest("hex")
    .slice(0, 12);
}

function buildBindingRecords(
  catalog: Catalog,
  schemas: readonly DataSchema[],
  bindings: readonly DataObjectBinding[],
): BindingRecord[] {
  const schemaMap = new Map(
    schemas.map((schema) => [toSchemaKey(schema.schemaId, schema.version), schema]),
  );
  const sortedBindings = bindings.toSorted(compareBindings);
  const usedInterfaceNames = new Set<string>();

  return sortedBindings.map((binding) => {
    const schemaKey = toSchemaKey(binding.schemaId, binding.schemaVersion);
    const schema = schemaMap.get(schemaKey);
    if (!schema) {
      throw new Error(`schema "${binding.schemaId}@${binding.schemaVersion}" 없음`);
    }

    const prefix = catalog.prefixes[binding.prefixId];
    if (!prefix) {
      throw new Error(`prefix "${binding.prefixId}" 없음`);
    }

    const prefixVersion = prefix.versions.find((version) => version.version === binding.prefixVersion);
    if (!prefixVersion) {
      throw new Error(`prefix version "${binding.prefixId}:${binding.prefixVersion}" 없음`);
    }

    const interfaceName = allocateInterfaceName(usedInterfaceNames, binding.prefixId, binding.schemaId);

    return {
      binding,
      schema,
      prefix,
      prefixVersion,
      interfaceName,
      boundTypeName: `${toPascal(binding.schemaId)}${toPascal(binding.prefixId)}BoundDataObject`,
      bindingConstName: `${toUpperSnake(binding.schemaId)}_${toUpperSnake(binding.prefixId)}_BINDING`,
    };
  });
}

function allocateInterfaceName(
  usedNames: Set<string>,
  prefixId: string,
  schemaId: string,
): string {
  const base = `${toPascal(prefixId)}Data`;
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }

  const versioned = `${toPascal(schemaId)}${toPascal(prefixId)}Data`;
  usedNames.add(versioned);
  return versioned;
}

function generateDataObjectsFile(
  catalog: Catalog,
  contentHash: string,
  records: readonly BindingRecord[],
): string {
  const lines = [header(catalog.id, contentHash)];
  const prefixToInterfaces = new Map<string, string[]>();

  lines.push(`export interface GeneratedBoundDataObject<`);
  lines.push(`  S extends string,`);
  lines.push(`  P extends string,`);
  lines.push(`  TData extends Record<string, unknown>,`);
  lines.push(`> {`);
  lines.push(`  readonly schemaId: S;`);
  lines.push(`  readonly prefixId: P;`);
  lines.push(`  readonly data: TData;`);
  lines.push(`  readonly address: number;`);
  lines.push(`  readonly serialized: string;`);
  lines.push(`}`);
  lines.push(``);

  for (const record of records) {
    lines.push(`/** ${record.schema.schemaId}@${record.schema.version} → ${record.binding.prefixId}:${record.binding.prefixVersion} */`);
    lines.push(`export interface ${record.interfaceName} {`);

    const mappings = Object.entries(record.binding.columnToAxis).toSorted(([left], [right]) => left.localeCompare(right));
    for (const [columnId, mapping] of mappings) {
      const optional = record.schema.columns[columnId]?.required === false ? "?" : "";
      lines.push(`  ${renderPropertyKey(columnId)}${optional}: ${resolveMappedType(catalog, record, mapping.dimLabel)};`);
    }

    lines.push(`}`);
    lines.push(``);
    lines.push(
      `export type ${record.boundTypeName} = GeneratedBoundDataObject<"${record.schema.schemaId}", "${record.binding.prefixId}", ${record.interfaceName}>;`,
    );
    lines.push(``);

    const interfaces = prefixToInterfaces.get(record.binding.prefixId) ?? [];
    interfaces.push(record.interfaceName);
    prefixToInterfaces.set(record.binding.prefixId, interfaces);
  }

  lines.push(`export interface PrefixDataObjectMap {`);
  for (const [prefixId, interfaceNames] of [...prefixToInterfaces.entries()].toSorted(([left], [right]) => left.localeCompare(right))) {
    lines.push(`  ${JSON.stringify(prefixId)}: ${interfaceNames.join(" | ")};`);
  }
  lines.push(`}`);
  lines.push(``);
  lines.push(`export type PrefixDataObject = PrefixDataObjectMap[keyof PrefixDataObjectMap];`);
  lines.push(``);

  return `${lines.join("\n")}\n`;
}

function generateBindingRegistryFile(
  catalogId: string,
  contentHash: string,
  records: readonly BindingRecord[],
): string {
  const lines = [header(catalogId, contentHash)];
  const prefixGroups = new Map<string, BindingRecord[]>();

  for (const record of records) {
    const group = prefixGroups.get(record.binding.prefixId) ?? [];
    group.push(record);
    prefixGroups.set(record.binding.prefixId, group);
  }

  lines.push(`export interface ColumnAxisMapping {`);
  lines.push(`  readonly dimLabel: string;`);
  lines.push(`  readonly segmentId?: string;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export interface DataObjectBinding {`);
  lines.push(`  readonly schemaId: string;`);
  lines.push(`  readonly schemaVersion: string;`);
  lines.push(`  readonly prefixId: string;`);
  lines.push(`  readonly prefixVersion: string;`);
  lines.push(`  readonly columnToAxis: Record<string, ColumnAxisMapping>;`);
  lines.push(`}`);
  lines.push(``);

  for (const record of records) {
    lines.push(`export const ${record.bindingConstName}: DataObjectBinding = {`);
    lines.push(`  schemaId: ${JSON.stringify(record.binding.schemaId)},`);
    lines.push(`  schemaVersion: ${JSON.stringify(record.binding.schemaVersion)},`);
    lines.push(`  prefixId: ${JSON.stringify(record.binding.prefixId)},`);
    lines.push(`  prefixVersion: ${JSON.stringify(record.binding.prefixVersion)},`);
    lines.push(`  columnToAxis: {`);
    for (const [columnId, mapping] of Object.entries(record.binding.columnToAxis).toSorted(([left], [right]) => left.localeCompare(right))) {
      lines.push(`    ${renderObjectLiteralKey(columnId)}: {`);
      lines.push(`      dimLabel: ${JSON.stringify(mapping.dimLabel)},`);
      if (mapping.segmentId) {
        lines.push(`      segmentId: ${JSON.stringify(mapping.segmentId)},`);
      }
      lines.push(`    },`);
    }
    lines.push(`  },`);
    lines.push(`};`);
    lines.push(``);
  }

  lines.push(`export const DATA_OBJECT_BINDINGS = [`);
  for (const record of records) {
    lines.push(`  ${record.bindingConstName},`);
  }
  lines.push(`] as const satisfies readonly DataObjectBinding[];`);
  lines.push(``);

  lines.push(`export type BindingSchemaId = typeof DATA_OBJECT_BINDINGS[number]["schemaId"];`);
  lines.push(`export type BindingPrefixId = typeof DATA_OBJECT_BINDINGS[number]["prefixId"];`);
  lines.push(``);
  lines.push(`export interface BindingRegistryState {`);
  lines.push(`  readonly bySchema: Record<BindingSchemaId, DataObjectBinding>;`);
  lines.push(`  readonly byPrefix: Record<BindingPrefixId, readonly DataObjectBinding[]>;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export function createBindingRegistry(): BindingRegistryState {`);
  lines.push(`  return {`);
  lines.push(`    bySchema: {`);
  for (const record of records) {
    lines.push(`      ${JSON.stringify(record.binding.schemaId)}: ${record.bindingConstName},`);
  }
  lines.push(`    },`);
  lines.push(`    byPrefix: {`);
  for (const [prefixId, groupedRecords] of [...prefixGroups.entries()].toSorted(([left], [right]) => left.localeCompare(right))) {
    lines.push(`      ${JSON.stringify(prefixId)}: [${groupedRecords.map((record) => record.bindingConstName).join(", ")}],`);
  }
  lines.push(`    },`);
  lines.push(`  };`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export const BINDING_REGISTRY = createBindingRegistry();`);
  lines.push(``);

  return `${lines.join("\n")}\n`;
}

function generateLineageTypesFile(
  catalogId: string,
  contentHash: string,
  records: readonly BindingRecord[],
): string {
  const lines = [header(catalogId, contentHash)];
  const lineagePairs = buildLineagePairs(records);

  for (const pair of lineagePairs) {
    lines.push(
      `/** ${pair.source.schema.schemaId}@${pair.source.schema.version} → ${pair.target.schema.schemaId}@${pair.target.schema.version} 직접 계보 후보 */`,
    );
    lines.push(`export type ${pair.aliasName} =`);
    for (let index = 0; index < pair.fields.length; index += 1) {
      const suffix = index === pair.fields.length - 1 ? ";" : "";
      lines.push(`  | ${JSON.stringify(pair.fields[index])}${suffix}`);
    }
    lines.push(``);
  }

  lines.push(`export interface ValidLineageMap {`);
  for (const pair of lineagePairs) {
    lines.push(`  ${JSON.stringify(`${pair.source.schema.schemaId}->${pair.target.schema.schemaId}`)}: ${pair.aliasName};`);
  }
  lines.push(`}`);
  lines.push(``);

  if (lineagePairs.length === 0) {
    lines.push(`export type ValidLineage = never;`);
    lines.push(``);
    return `${lines.join("\n")}\n`;
  }

  lines.push(`export type ValidLineage =`);
  for (let index = 0; index < lineagePairs.length; index += 1) {
    const pair = lineagePairs[index];
    const suffix = index === lineagePairs.length - 1 ? ";" : "";
    lines.push(`  | {`);
    lines.push(`      source: ${JSON.stringify(pair.source.schema.schemaId)};`);
    lines.push(`      target: ${JSON.stringify(pair.target.schema.schemaId)};`);
    lines.push(`      field: ${pair.aliasName};`);
    lines.push(`      transform: "direct";`);
    lines.push(`    }${suffix}`);
  }
  lines.push(``);

  return `${lines.join("\n")}\n`;
}

function generateIndexFile(catalogId: string, contentHash: string): string {
  return [
    header(catalogId, contentHash),
    `export * from "./data-objects.js";`,
    `export * from "./binding-registry.js";`,
    `export * from "./lineage-types.js";`,
    ``,
  ].join("\n");
}

function buildLineagePairs(records: readonly BindingRecord[]): LineagePair[] {
  const pairs: LineagePair[] = [];

  for (const source of records) {
    for (const target of records) {
      if (source.schema.schemaId === target.schema.schemaId && source.schema.version === target.schema.version) {
        continue;
      }

      const fields = findCompatibleFields(source, target);
      if (fields.length === 0) {
        continue;
      }

      pairs.push({
        source,
        target,
        aliasName: `${toPascal(source.schema.schemaId)}${toPascal(source.schema.version)}To${toPascal(target.schema.schemaId)}${toPascal(target.schema.version)}LineageField`,
        fields,
      });
    }
  }

  return pairs.toSorted((left, right) => compareLineagePairs(left, right));
}

function findCompatibleFields(source: BindingRecord, target: BindingRecord): string[] {
  const sharedColumns = Object.keys(source.schema.columns)
    .filter((columnId) => Object.hasOwn(target.schema.columns, columnId))
    .toSorted((left, right) => left.localeCompare(right));

  return sharedColumns.filter((columnId) => {
    const sourceColumn = source.schema.columns[columnId];
    const targetColumn = target.schema.columns[columnId];

    return areColumnRefsCompatible(sourceColumn, targetColumn)
      && isLineageMappingCompatible(
        source.binding.columnToAxis[columnId] ?? null,
        target.binding.columnToAxis[columnId] ?? null,
      );
  });
}

function areColumnRefsCompatible(sourceColumn: DataColumn, targetColumn: DataColumn): boolean {
  const sourceRef = sourceColumn.ref;
  const targetRef = targetColumn.ref;

  switch (sourceRef.kind) {
    case "scalar":
      return targetRef.kind === "scalar" && sourceRef.type === targetRef.type;
    case "axis_ref":
      return targetRef.kind === "axis_ref" && sourceRef.axisId === targetRef.axisId;
    case "prefix_ref":
      return targetRef.kind === "prefix_ref" && sourceRef.prefixId === targetRef.prefixId;
    case "table_ref":
      return targetRef.kind === "table_ref" && sourceRef.table === targetRef.table;
  }
}

function isLineageMappingCompatible(
  sourceMapping: DataObjectBinding["columnToAxis"][string] | null,
  targetMapping: DataObjectBinding["columnToAxis"][string] | null,
): boolean {
  if (!targetMapping) {
    return true;
  }

  if (!sourceMapping) {
    return false;
  }

  return sourceMapping.dimLabel === targetMapping.dimLabel
    && (sourceMapping.segmentId ?? "") === (targetMapping.segmentId ?? "");
}

function resolveMappedType(catalog: Catalog, record: BindingRecord, dimLabel: string): string {
  const dim = record.prefix.dims[dimLabel];
  if (!dim) {
    throw new Error(`dim "${record.binding.prefixId}.${dimLabel}" 없음`);
  }

  switch (dim.kind) {
    case "axis": {
      const axis = catalog.axes[dim.axisId];
      if (!axis) {
        throw new Error(`axis "${dim.axisId}" 없음`);
      }

      const axisVersion = record.prefixVersion.axisVersions[dim.axisId]
        ?? Object.keys(axis.versions).toSorted().at(-1);
      if (!axisVersion) {
        throw new Error(`axis "${dim.axisId}" version 정보를 찾을 수 없음`);
      }

      const snapshot = axis.versions[axisVersion];
      if (!snapshot) {
        throw new Error(`axis version "${dim.axisId}@${axisVersion}"를 찾을 수 없음`);
      }

      return axisEntriesToType(snapshot);
    }
    case "prefix_ref":
    case "table_ref":
      return "number";
    default:
      return assertNever(dim);
  }
}

function axisEntriesToType(snapshot: AxisVersionSnapshot): string {
  if (snapshot.entries.length === 0) {
    return "string";
  }

  return snapshot.entries.map((entry) => JSON.stringify(entry)).join(" | ");
}

function compareBindings(left: DataObjectBinding, right: DataObjectBinding): number {
  return left.prefixId.localeCompare(right.prefixId)
    || left.prefixVersion.localeCompare(right.prefixVersion)
    || left.schemaId.localeCompare(right.schemaId)
    || left.schemaVersion.localeCompare(right.schemaVersion);
}

function compareLineagePairs(left: LineagePair, right: LineagePair): number {
  return left.source.schema.schemaId.localeCompare(right.source.schema.schemaId)
    || left.target.schema.schemaId.localeCompare(right.target.schema.schemaId)
    || left.source.schema.version.localeCompare(right.source.schema.version)
    || left.target.schema.version.localeCompare(right.target.schema.version);
}

function toSchemaKey(schemaId: string, version: string): string {
  return `${schemaId}@${version}`;
}

function header(catalogId: string, contentHash: string): string {
  return [
    `// Generated from Data Object Catalog "${catalogId}" (hash: ${contentHash})`,
    `// !! 자동 생성 파일 — 직접 수정 금지 !!`,
    ``,
  ].join("\n");
}

function renderPropertyKey(key: string): string {
  return isIdentifier(key) ? key : JSON.stringify(key);
}

function renderObjectLiteralKey(key: string): string {
  return isIdentifier(key) ? key : JSON.stringify(key);
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value);
}

function toPascal(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toUpperSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[^A-Za-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toUpperCase();
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).toSorted(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeCatalog(catalog: Catalog): unknown {
  return {
    id: catalog.id,
    axes: Object.fromEntries(
      Object.entries(catalog.axes)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([axisId, axis]) => [
          axisId,
          {
            id: axis.id,
            name: axis.name,
            versions: Object.fromEntries(
              Object.entries(axis.versions)
                .toSorted(([left], [right]) => left.localeCompare(right))
                .map(([version, snapshot]) => [
                  version,
                  {
                    entries: [...snapshot.entries],
                    capacity: snapshot.capacity ?? null,
                  },
                ]),
            ),
          },
        ]),
    ),
    prefixes: Object.fromEntries(
      Object.entries(catalog.prefixes)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([prefixId, prefix]) => [
          prefixId,
          {
            id: prefix.id,
            labels: [...prefix.labels],
            dims: Object.fromEntries(
              Object.entries(prefix.dims)
                .toSorted(([left], [right]) => left.localeCompare(right))
                .map(([dimLabel, dim]) => [dimLabel, { ...dim }]),
            ),
            addressModel: prefix.addressModel ?? "product",
            versions: prefix.versions
              .toSorted((left, right) => left.version.localeCompare(right.version))
              .map((version) => ({
                version: version.version,
                axisVersions: Object.fromEntries(
                  Object.entries(version.axisVersions).toSorted(([left], [right]) => left.localeCompare(right)),
                ),
                refEntries: version.refEntries
                  ? Object.fromEntries(
                    Object.entries(version.refEntries)
                      .toSorted(([left], [right]) => left.localeCompare(right))
                      .map(([key, value]) => [key, { refVersion: value.refVersion, values: [...value.values] }]),
                  )
                  : null,
                segments: normalizeSegments(version.segments),
              })),
          },
        ]),
    ),
  };
}

function normalizeSegments(segments: PrefixVersionDef["segments"]): unknown {
  if (!segments) {
    return null;
  }

  return segments.map((segment) => ({
    segmentId: segment.segmentId,
    consumes: [...segment.consumes],
    shape: [...segment.shape],
    addressOffset: segment.addressOffset,
    size: segment.size,
    transition: segment.transition ?? null,
    routes: segment.routes
      ? segment.routes.map((route) => ({
        when: route.when,
        transition: route.transition,
      }))
      : null,
    children: normalizeSegments(segment.children),
  }));
}

function normalizeSchemas(schemas: readonly DataSchema[]): unknown {
  return schemas
    .toSorted((left, right) => left.schemaId.localeCompare(right.schemaId) || left.version.localeCompare(right.version))
    .map((schema) => ({
      schemaId: schema.schemaId,
      version: schema.version,
      primaryKey: [...schema.primaryKey],
      schemaHash: schema.schemaHash,
      columns: Object.fromEntries(
        Object.entries(schema.columns)
          .toSorted(([left], [right]) => left.localeCompare(right))
          .map(([columnId, column]) => [
            columnId,
            {
              required: column.required,
              facetRole: column.facetRole ?? null,
              ref: { ...column.ref },
              defaultValue: column.defaultValue ?? null,
              constraints: column.constraints?.map((constraint) => ({ ...constraint })) ?? null,
            },
          ]),
      ),
    }));
}

function normalizeBindings(bindings: readonly DataObjectBinding[]): unknown {
  return bindings
    .toSorted(compareBindings)
    .map((binding) => ({
      schemaId: binding.schemaId,
      schemaVersion: binding.schemaVersion,
      prefixId: binding.prefixId,
      prefixVersion: binding.prefixVersion,
      columnToAxis: Object.fromEntries(
        Object.entries(binding.columnToAxis)
          .toSorted(([left], [right]) => left.localeCompare(right))
          .map(([columnId, mapping]) => [columnId, { dimLabel: mapping.dimLabel, segmentId: mapping.segmentId ?? null }]),
      ),
    }));
}

function assertNever(value: never): never {
  throw new Error(`지원하지 않는 값: ${JSON.stringify(value)}`);
}
