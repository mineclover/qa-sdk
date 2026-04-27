import ts from "typescript";

export type ArchitectureIssueSeverity = "error" | "warning";

export interface SourceFileInput {
  readonly path: string;
  readonly content: string;
}

export interface ArchitectureIssue {
  readonly ruleId: string;
  readonly severity: ArchitectureIssueSeverity;
  readonly path: string;
  readonly message: string;
  readonly importPath?: string;
}

export interface ArchitectureValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ArchitectureIssue[];
}

type Layer = "domain" | "application" | "infrastructure" | "presentation" | "module" | "unknown";

/**
 * 슬라이스 위상 (topology).
 *
 * Validator 가 슬라이스 별 룰을 first-class 로 분기할 때 사용하는 식별자다.
 * `metadata/openmetadata.seed.json` 의 top-level `topology` 필드 또는 (폴백)
 * 슬라이스 내부 시그너처로 추론한다.
 *
 * - `service`: aggregate + use-case + outbox 가 정상인 표준 도메인 슬라이스 (기본값).
 * - `read-model`: 쓰기 명령은 admin port 로 분리되고 application/queries/* +
 *    infrastructure/read-model/* 가 핵심 산출물. transaction/outbox/use-case 부재가 정상.
 * - `bff`: presentation/bff/* 합성 슬라이스. aggregate/transaction/outbox 부재가 정상.
 * - `command-only`: aggregate 없는 순수 command (예: authenticate). entity/read-model 부재가 정상.
 * - `read-mostly`: read-model 위주 cache/lookup (예: bitmap). transaction/outbox 부재가 정상.
 */
export type SliceTopology = "service" | "read-model" | "bff" | "command-only" | "read-mostly";

const KNOWN_TOPOLOGIES: ReadonlySet<SliceTopology> = new Set([
  "service",
  "read-model",
  "bff",
  "command-only",
  "read-mostly",
]);

export function validateArchitecture(files: readonly SourceFileInput[]): ArchitectureValidationResult {
  const slices = groupByDomainSlice(files);
  const topologyByRoot = new Map<string, SliceTopology>();
  for (const [root, sliceFiles] of slices) {
    topologyByRoot.set(root, resolveTopology(sliceFiles));
  }

  const issues = [
    ...files.flatMap((file) => validateFile(file, topologyByRoot)),
    ...validateDomainSlices(files, slices, topologyByRoot),
  ];
  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

function validateFile(
  file: SourceFileInput,
  topologyByRoot: ReadonlyMap<string, SliceTopology>,
): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];

  if (isOpenApiFile(file.path) && file.content.includes("Entity")) {
    issues.push(createIssue(
      "openapi-does-not-expose-domain-entity",
      file.path,
      "",
      "OpenAPI fragments must not expose domain entity types.",
    ));
  }

  const layer = detectLayer(file.path);
  if (layer === "unknown" || !file.path.endsWith(".ts")) return issues;

  const imports = readImports(file);

  for (const importPath of imports) {
    if (layer === "domain" && isForbiddenDomainImport(importPath)) {
      issues.push(
        createIssue(
          "domain-is-pure",
          file.path,
          importPath,
          "Domain layer must not import framework or adapter dependencies.",
        ),
      );
    }

    if (layer === "application" && isInfrastructureImport(importPath)) {
      issues.push(
        createIssue(
          "application-uses-ports",
          file.path,
          importPath,
          "Application layer must depend on ports, not infrastructure adapters.",
        ),
      );
    }

    if (layer === "presentation" && isInfrastructureImport(importPath)) {
      issues.push(
        createIssue(
          "presentation-calls-application",
          file.path,
          importPath,
          "Presentation layer must call application use cases, not infrastructure adapters.",
        ),
      );
    }

    if (isCrossDomainDeepImport(file.path, importPath)) {
      issues.push(
        createIssue(
          "bounded-context-uses-contracts",
          file.path,
          importPath,
          "Cross-domain access must use query ports, published contracts, or projections instead of deep domain/infrastructure imports.",
        ),
      );
    }
  }

  if (isUseCaseFile(file.path)) {
    const sliceRoot = domainSliceRoot(file.path);
    const topology = sliceRoot ? topologyByRoot.get(sliceRoot) ?? "service" : "service";
    // read-model / bff / read-mostly 는 use-case 자체가 흔치 않지만, 만에 하나 존재한다면
    // logger 만 강제하고 transaction port 는 강제하지 않는다 (쓰기 책임 부재).
    const enforceTransactionPort =
      topology === "service" || topology === "command-only";

    if (enforceTransactionPort && !file.content.includes("TransactionPort")) {
      issues.push(createIssue(
        "transaction-and-logging-are-ports",
        file.path,
        "",
        "Use case must depend on a transaction port.",
      ));
    }
    if (!file.content.includes("LoggerPort")) {
      issues.push(createIssue(
        "transaction-and-logging-are-ports",
        file.path,
        "",
        "Use case must depend on a logger port.",
      ));
    }
  }

  if (isBffFile(file.path)) {
    if (file.content.includes("Entity")) {
      issues.push(createIssue(
        "bff-does-not-expose-domain-entity",
        file.path,
        "",
        "BFF surface must not import or expose domain entities.",
      ));
    }
    if (file.content.includes(".save(") || file.content.includes(" save(")) {
      issues.push(createIssue(
        "bff-does-not-expose-domain-entity",
        file.path,
        "",
        "BFF surface must not perform persistence writes.",
      ));
    }
  }

  return issues;
}

function validateDomainSlices(
  files: readonly SourceFileInput[],
  slices: ReadonlyMap<string, SourceFileInput[]>,
  topologyByRoot: ReadonlyMap<string, SliceTopology>,
): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];

  for (const [root, sliceFiles] of slices) {
    const topology = topologyByRoot.get(root) ?? "service";

    if (!isDomainSliceProperlyGrouped(root, files)) {
      issues.push(createIssue(
        "domain-slice-under-modules",
        root,
        "",
        "Domain slices must live under modules/<domain> or share a parent <domain>-slices.registry.ts marker to keep bounded contexts grouped.",
      ));
    }

    const hasReadModel = sliceFiles.some((file) => file.path.includes("/application/queries/")
      || file.path.includes("/infrastructure/read-model/"));
    const hasBff = sliceFiles.some((file) => file.path.includes("/presentation/bff/"));
    const metadata = sliceFiles.find((file) => file.path.endsWith("/metadata/openmetadata.seed.json"));
    const hasTransactionPort = sliceFiles.some((file) => file.path.includes("/application/ports/")
      && file.path.endsWith("-transaction.port.ts"));
    const hasOutboxPort = sliceFiles.some((file) => file.path.includes("/application/ports/")
      && file.path.endsWith("-outbox.port.ts"));
    const hasUnitOfWork = sliceFiles.some((file) => file.path.includes("/infrastructure/transaction/")
      && file.path.endsWith(".unit-of-work.ts"));

    // 위상 별 룰 분기.
    //
    // - service / command-only: transaction + outbox 가 함께 선언되면 unit-of-work 필수.
    // - read-model / bff / read-mostly: 트랜잭션 자체가 위상상 부재해야 정상.
    //   (admin port 로 분리된 변형 명령은 service 슬라이스가 책임지지 않음)
    const enforceTxOutboxUow =
      topology === "service" || topology === "command-only";
    if (enforceTxOutboxUow && hasTransactionPort && hasOutboxPort && !hasUnitOfWork) {
      issues.push(createIssue(
        "transaction-outbox-use-unit-of-work",
        root,
        "",
        "Domain slice with transaction and outbox ports must include infrastructure/transaction/*.unit-of-work.ts.",
      ));
    }

    // 위상이 명시되지 않은 슬라이스에서 read-model/BFF 시그너처가 보이는데 metadata 가
    // 없다면 governance seed 누락으로 판단. 위상이 'service' 라도 read-model/BFF
    // 시그너처가 보이면 동일하게 강제 (legacy 컨벤션 호환).
    if ((hasReadModel || hasBff) && !metadata) {
      issues.push(createIssue(
        "metadata-ships-with-domain-slice",
        root,
        "",
        "Domain slice with read model or BFF must include metadata/openmetadata.seed.json.",
      ));
      continue;
    }

    // 위상에 따라 metadata 필수성을 강제 — read-model/bff/read-mostly 는 OM seed 가
    // governance SSOT 이므로 반드시 존재해야 한다.
    if (
      !metadata
      && (topology === "read-model" || topology === "bff" || topology === "read-mostly")
    ) {
      issues.push(createIssue(
        "metadata-ships-with-domain-slice",
        root,
        "",
        `${topology} domain slice must include metadata/openmetadata.seed.json.`,
      ));
      continue;
    }

    if (!metadata) continue;

    const cacheIds = readCacheKeyIds(metadata);
    const domainName = root.split("/").at(-1) ?? "domain";

    // read-model / bff cache key 강제는 위상 또는 시그너처가 명시할 때만 발동.
    // 'service' 위상에서도 read-model 시그너처가 있으면 cache key 를 요구한다 (호환).
    const requiresReadModelCache =
      topology === "read-model" || topology === "read-mostly"
      || (topology === "service" && hasReadModel);
    if (requiresReadModelCache && !cacheIds.some((id) => id.includes("read-model"))) {
      issues.push(createIssue(
        "metadata-ships-with-domain-slice",
        metadata.path,
        "",
        "Read model domain slice must include a read-model cache key metadata entry.",
      ));
    }

    const requiresBffCache =
      topology === "bff" || (topology === "service" && hasBff);
    if (requiresBffCache && !cacheIds.some((id) => id.includes("bff"))) {
      issues.push(createIssue(
        "metadata-ships-with-domain-slice",
        metadata.path,
        "",
        `BFF domain slice must include a BFF cache key metadata entry for ${domainName}.`,
      ));
    }

    // 위상 별 산출물 가시성 — read-model/bff 는 본체 산출물이 위상에 맞춰 존재해야 한다.
    if (topology === "read-model" && !hasReadModel) {
      issues.push(createIssue(
        "topology-shape-mismatch",
        root,
        "",
        "read-model topology slice must ship application/queries/* or infrastructure/read-model/*.",
      ));
    }
    if (topology === "bff" && !hasBff) {
      issues.push(createIssue(
        "topology-shape-mismatch",
        root,
        "",
        "bff topology slice must ship presentation/bff/* surface.",
      ));
    }
  }

  return issues;
}

/**
 * 슬라이스의 위상을 결정한다.
 *
 * 1순위: `metadata/openmetadata.seed.json` 의 top-level `topology` 필드.
 * 2순위: 슬라이스 디렉터리 시그너처 (presentation/bff → bff, queries/read-model → read-model).
 * 3순위 (기본): `service`.
 *
 * 1순위가 우선이지만, 명시된 값이 알려진 위상이 아니면 fall through 한다 (unknown 값 무시).
 */
function resolveTopology(sliceFiles: readonly SourceFileInput[]): SliceTopology {
  const metadata = sliceFiles.find((file) =>
    file.path.endsWith("/metadata/openmetadata.seed.json"));
  if (metadata) {
    const declared = readDeclaredTopology(metadata);
    if (declared) return declared;
  }

  const hasBff = sliceFiles.some((file) => file.path.includes("/presentation/bff/"));
  if (hasBff) return "bff";

  const hasUseCase = sliceFiles.some((file) =>
    file.path.includes("/application/use-cases/")
    && file.path.endsWith(".use-case.ts"));
  const hasReadModelArtifact = sliceFiles.some((file) =>
    file.path.includes("/application/queries/")
    || file.path.includes("/infrastructure/read-model/"));
  if (hasReadModelArtifact && !hasUseCase) {
    return "read-model";
  }

  return "service";
}

function readDeclaredTopology(file: SourceFileInput): SliceTopology | null {
  try {
    const parsed = JSON.parse(file.content) as { topology?: unknown };
    const value = parsed.topology;
    if (typeof value === "string" && KNOWN_TOPOLOGIES.has(value as SliceTopology)) {
      return value as SliceTopology;
    }
  } catch {
    // ignore — JSON parse 오류는 다른 governance check 에서 잡는다.
  }
  return null;
}

function isDomainSliceUnderModules(root: string): boolean {
  const normalized = root.replace(/\\/g, "/");
  return normalized.includes("/modules/") || normalized.startsWith("modules/");
}

/**
 * 슬라이스가 적절히 그룹핑되어 있는지 판정한다.
 * 1) 전통 컨벤션: `modules/<domain>/<slice>` 하위
 * 2) 시뮬레이션 컨벤션: 부모 디렉터리에 `<domain>-slices.registry.ts` 마커가 존재
 *    (예: `services/pm-api/src/pm/pm-slices.registry.ts` + `services/pm-api/src/pm/assignment/`)
 */
function isDomainSliceProperlyGrouped(root: string, files: readonly SourceFileInput[]): boolean {
  if (isDomainSliceUnderModules(root)) {
    return true;
  }
  const normalized = root.replace(/\\/g, "/");
  const parent = normalized.split("/").slice(0, -1).join("/");
  if (!parent) return false;
  // 부모 또는 조상 (1단계 위까지) 의 *-slices.registry.ts 마커를 찾는다.
  // density 같은 경우 슬라이스가 src/density/, marker 가 src/density-slices.registry.ts 형태여서
  // 부모와 같은 깊이의 marker 도 허용해야 한다.
  return files.some((file) => {
    const filePath = file.path.replace(/\\/g, "/");
    if (!filePath.endsWith("-slices.registry.ts")) return false;
    const fileDir = filePath.split("/").slice(0, -1).join("/");
    return fileDir === parent || fileDir === normalized.split("/").slice(0, -2).join("/");
  });
}

function readImports(file: SourceFileInput): string[] {
  const sourceFile = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (ts.isStringLiteral(specifier)) {
      imports.push(specifier.text);
    }
  }

  return imports;
}

function detectLayer(path: string): Layer {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.includes("/domain/")) return "domain";
  if (normalized.includes("/application/")) return "application";
  if (normalized.includes("/infrastructure/")) return "infrastructure";
  if (normalized.includes("/presentation/")) return "presentation";
  if (normalized.endsWith(".module.ts")) return "module";
  return "unknown";
}

function isUseCaseFile(path: string): boolean {
  return path.replace(/\\/g, "/").includes("/application/use-cases/")
    && path.endsWith(".use-case.ts");
}

function isBffFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return normalized.includes("/presentation/bff/") && normalized.endsWith(".ts");
}

function isOpenApiFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return normalized.endsWith(".openapi.json")
    || (normalized.includes("/openapi/domains/") && normalized.endsWith("/spec.json"));
}

function groupByDomainSlice(files: readonly SourceFileInput[]): Map<string, SourceFileInput[]> {
  const groups = new Map<string, SourceFileInput[]>();
  for (const file of files) {
    const root = domainSliceRoot(file.path);
    if (!root) continue;
    const existing = groups.get(root) ?? [];
    existing.push(file);
    groups.set(root, existing);
  }
  return groups;
}

function domainSliceRoot(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const markers = [
    "/domain/",
    "/application/",
    "/infrastructure/",
    "/presentation/",
    "/metadata/",
    "/contracts/",
  ];
  const indexes = markers
    .map((marker) => normalized.indexOf(marker))
    .filter((index) => index >= 0);
  if (indexes.length === 0) return null;
  return normalized.slice(0, Math.min(...indexes));
}

function isCrossDomainDeepImport(filePath: string, importPath: string): boolean {
  const fromRoot = domainSliceRoot(filePath);
  if (!fromRoot) return false;

  const resolved = resolveImportTarget(filePath, importPath);
  if (!resolved) return false;
  const toRoot = domainSliceRoot(resolved);
  if (!toRoot || toRoot === fromRoot) return false;

  return resolved.includes("/domain/")
    || resolved.includes("/infrastructure/")
    || resolved.includes("/persistence/");
}

function resolveImportTarget(filePath: string, importPath: string): string | null {
  const aliasTarget = resolveModuleAlias(importPath);
  if (aliasTarget) return aliasTarget;
  if (!importPath.startsWith(".")) return null;
  return resolveRelativeImport(filePath, importPath);
}

function resolveModuleAlias(importPath: string): string | null {
  const normalized = importPath.replace(/\\/g, "/");
  const aliases = [
    ["@modules/", "src/modules/"],
    ["@/modules/", "src/modules/"],
    ["@src/modules/", "src/modules/"],
    ["src/modules/", "src/modules/"],
  ] as const;

  for (const [prefix, replacement] of aliases) {
    if (normalized.startsWith(prefix)) {
      return `${replacement}${normalized.slice(prefix.length)}`;
    }
  }

  return null;
}

function resolveRelativeImport(filePath: string, importPath: string): string {
  const fromParts = filePath.replace(/\\/g, "/").split("/").slice(0, -1);
  const targetParts = importPath.split("/");
  for (const part of targetParts) {
    if (part === "." || part.length === 0) continue;
    if (part === "..") {
      fromParts.pop();
      continue;
    }
    fromParts.push(part);
  }
  return fromParts.join("/");
}

function readCacheKeyIds(file: SourceFileInput): string[] {
  try {
    const parsed = JSON.parse(file.content) as { cacheKeys?: Array<{ id?: unknown }> };
    if (!Array.isArray(parsed.cacheKeys)) return [];
    return parsed.cacheKeys
      .map((entry) => typeof entry.id === "string" ? entry.id : "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isForbiddenDomainImport(importPath: string): boolean {
  return importPath.startsWith("@nestjs/")
    || importPath === "drizzle-orm"
    || importPath.startsWith("drizzle-orm/")
    || isInfrastructureImport(importPath);
}

function isInfrastructureImport(importPath: string): boolean {
  return importPath.includes("/infrastructure/")
    || importPath.startsWith("../infrastructure/")
    || importPath.startsWith("../../infrastructure/")
    || importPath === "drizzle-orm"
    || importPath.startsWith("drizzle-orm/");
}

function createIssue(ruleId: string, path: string, importPath: string, message: string): ArchitectureIssue {
  return {
    ruleId,
    severity: "error",
    path,
    importPath: importPath || undefined,
    message,
  };
}
