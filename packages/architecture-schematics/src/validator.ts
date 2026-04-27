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

export function validateArchitecture(files: readonly SourceFileInput[]): ArchitectureValidationResult {
  const issues = [
    ...files.flatMap(validateFile),
    ...validateDomainSlices(files),
  ];
  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

function validateFile(file: SourceFileInput): ArchitectureIssue[] {
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
    if (!file.content.includes("TransactionPort")) {
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

function validateDomainSlices(files: readonly SourceFileInput[]): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  const slices = groupByDomainSlice(files);

  for (const [root, sliceFiles] of slices) {
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

    if (hasTransactionPort && hasOutboxPort && !hasUnitOfWork) {
      issues.push(createIssue(
        "transaction-outbox-use-unit-of-work",
        root,
        "",
        "Domain slice with transaction and outbox ports must include infrastructure/transaction/*.unit-of-work.ts.",
      ));
    }

    if ((hasReadModel || hasBff) && !metadata) {
      issues.push(createIssue(
        "metadata-ships-with-domain-slice",
        root,
        "",
        "Domain slice with read model or BFF must include metadata/openmetadata.seed.json.",
      ));
      continue;
    }

    if (!metadata) continue;

    const cacheIds = readCacheKeyIds(metadata);
    const domainName = root.split("/").at(-1) ?? "domain";
    if (hasReadModel && !cacheIds.some((id) => id.includes("read-model"))) {
      issues.push(createIssue(
        "metadata-ships-with-domain-slice",
        metadata.path,
        "",
        "Read model domain slice must include a read-model cache key metadata entry.",
      ));
    }
    if (hasBff && !cacheIds.some((id) => id.includes("bff"))) {
      issues.push(createIssue(
        "metadata-ships-with-domain-slice",
        metadata.path,
        "",
        `BFF domain slice must include a BFF cache key metadata entry for ${domainName}.`,
      ));
    }
  }

  return issues;
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
