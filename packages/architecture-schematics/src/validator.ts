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

  if (isOpenApiFile(file.path) && analyzeOpenApiEntityExposure(file)) {
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

    // AST 기반 검사 — substring 검사는 import 라인 한 줄 또는 주석/식별자 토큰으로
    // 우회 가능 (false negative). 실제 import + 실제 사용 (type reference / 식별자
    // 참조) 을 모두 확인한다.
    const usage = analyzePortUsage(file);

    if (enforceTransactionPort && !usage.hasTransactionPort) {
      issues.push(createIssue(
        "transaction-and-logging-are-ports",
        file.path,
        "",
        "Use case must depend on a transaction port.",
      ));
    }
    if (!usage.hasLoggerPort) {
      issues.push(createIssue(
        "transaction-and-logging-are-ports",
        file.path,
        "",
        "Use case must depend on a logger port.",
      ));
    }
  }

  if (isBffFile(file.path)) {
    if (analyzeBffEntityExposure(file)) {
      issues.push(createIssue(
        "bff-does-not-expose-domain-entity",
        file.path,
        "",
        "BFF surface must not import or expose domain entities.",
      ));
    }
    if (analyzeBffPersistenceWrite(file)) {
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

interface PortUsageAnalysis {
  /** TransactionPort symbol 이 import + 실제 사용 (type reference) 까지 갖춰진 경우 */
  readonly hasTransactionPort: boolean;
  /**
   * LoggerPort symbol 이 import + 실제 사용 (type reference) 으로 사용된 경우, 또는
   * SLICE_LOGGER_PORT (또는 *_LOGGER_PORT) 토큰이 import + 식별자 참조로 사용된 경우.
   */
  readonly hasLoggerPort: boolean;
}

/**
 * use-case 파일의 TransactionPort/LoggerPort 의존을 AST 로 분석한다.
 *
 * substring 검사는 import 한 줄만으로 또는 주석/변수명 토큰만으로 통과 가능했다
 * (false negative). 본 분석은 다음 두 단계를 모두 통과해야 "사용함" 으로 판정한다:
 *
 * 1. import declaration 의 named/namespace import 로 symbol 이 실제로 들여와짐.
 * 2. 본문에서 type reference (`ts.isTypeReferenceNode`) 또는 식별자 참조로 그
 *    symbol 이 등장.
 *
 * LoggerPort 의 경우 두 가지 정당한 패턴을 모두 허용한다:
 *
 * - LoggerPort 추상에 대한 type reference (예: `private readonly logger: AssignmentLoggerPort`).
 * - kit 의 `SLICE_LOGGER_PORT` 토큰을 inject 하는 패턴 (예: `@Inject(SLICE_LOGGER_PORT)`).
 *   이 경우 LoggerPort 타입 자체를 import 하지 않을 수 있어 type reference 만으로는
 *   누락된다. `*_LOGGER_PORT` 식별자가 import + 본문 참조로 등장하면 통과로 본다.
 */
function analyzePortUsage(file: SourceFileInput): PortUsageAnalysis {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const importedTypeSymbols = new Set<string>();
  const importedValueSymbols = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    const isTypeOnlyImport = clause.isTypeOnly === true;

    // default import: `import Foo from "..."` 는 TS value+type 모두에 바인딩.
    if (clause.name) {
      const name = clause.name.text;
      if (isTypeOnlyImport) importedTypeSymbols.add(name);
      else {
        importedTypeSymbols.add(name);
        importedValueSymbols.add(name);
      }
    }

    const bindings = clause.namedBindings;
    if (!bindings) continue;

    if (ts.isNamespaceImport(bindings)) {
      // `import * as ns from "..."` — 본문에서 `ns.X` 참조로 등장. 사용 검사는
      // 식별자 단위로만 하므로 namespace prefix 자체를 등록.
      const ns = bindings.name.text;
      if (isTypeOnlyImport) importedTypeSymbols.add(ns);
      else {
        importedTypeSymbols.add(ns);
        importedValueSymbols.add(ns);
      }
      continue;
    }

    if (ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const localName = element.name.text;
        const memberIsTypeOnly = element.isTypeOnly === true;
        const effectiveTypeOnly = isTypeOnlyImport || memberIsTypeOnly;
        importedTypeSymbols.add(localName);
        if (!effectiveTypeOnly) {
          importedValueSymbols.add(localName);
        }
      }
    }
  }

  // 본문 내 type reference 식별자 + 일반 식별자 참조 수집.
  const typeReferenceNames = new Set<string>();
  const identifierReferenceNames = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      // import 자체는 사용처가 아니다.
      return;
    }

    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName;
      if (ts.isIdentifier(typeName)) {
        typeReferenceNames.add(typeName.text);
      } else if (ts.isQualifiedName(typeName)) {
        // `ns.X` 형태 — leftmost identifier 만 등록 (namespace import 매칭용).
        let cursor: ts.EntityName = typeName;
        while (ts.isQualifiedName(cursor)) cursor = cursor.left;
        if (ts.isIdentifier(cursor)) typeReferenceNames.add(cursor.text);
      }
    }

    if (ts.isIdentifier(node)) {
      // type reference 의 typeName 은 위에서 처리했으므로 여기서는 일반 식별자
      // 참조 (값 참조) 를 수집한다. 단순히 모든 Identifier 를 모은다 — false
      // positive 가 있더라도 import 와의 교집합으로 좁히기 때문에 safe.
      identifierReferenceNames.add(node.text);
    }

    ts.forEachChild(node, visit);
  };

  // 파일 statements 를 순회하되 ImportDeclaration 자체는 건너뛴다.
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) continue;
    visit(statement);
  }

  const hasTransactionPort = anyMatch(
    importedTypeSymbols,
    typeReferenceNames,
    (name) => name.endsWith("TransactionPort"),
  );

  const hasLoggerPortType = anyMatch(
    importedTypeSymbols,
    typeReferenceNames,
    (name) => name.endsWith("LoggerPort"),
  );

  // SLICE_LOGGER_PORT / *_LOGGER_PORT 토큰 inject 케이스. 값 import + 값 참조.
  const hasLoggerPortToken = anyMatch(
    importedValueSymbols,
    identifierReferenceNames,
    (name) => name.endsWith('_LOGGER_PORT'),
  );

  return {
    hasTransactionPort,
    hasLoggerPort: hasLoggerPortType || hasLoggerPortToken,
  };
}

/**
 * BFF 파일이 도메인 Entity 를 노출하는지 AST 로 분석한다.
 *
 * substring 검사는 주석/문자열 리터럴/식별자 토큰 어디든 "Entity" 가 등장하면
 * 트리거되어 false positive 가 컸다. 본 분석은 다음 위치에서만 `*Entity` 식별자를
 * 검출한다:
 *
 * - import declaration 의 named/default/namespace import (`import { FooEntity }`,
 *   `import FooEntity from "..."`).
 * - 본문 type reference 노드 (`function f(): FooEntity`, `private readonly e: FooEntity`).
 *
 * 주석, string literal, regex literal, JSDoc, 그리고 식별자 prefix 가 우연히
 * 일치하는 케이스 (예: `Entitys` 같은 단어) 는 트리거하지 않는다. 단어 경계는
 * `endsWith("Entity")` 로 잡되 `Entity` 자체와 `*Entity` (camelCase suffix) 만
 * 허용한다.
 */
function analyzeBffEntityExposure(file: SourceFileInput): boolean {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const isEntityName = (name: string): boolean => name === "Entity" || name.endsWith("Entity");

  // 1) import declaration 검사.
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (!clause) continue;

    if (clause.name && isEntityName(clause.name.text)) return true;

    const bindings = clause.namedBindings;
    if (!bindings) continue;

    if (ts.isNamespaceImport(bindings)) {
      if (isEntityName(bindings.name.text)) return true;
      continue;
    }
    if (ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        // `import { OriginalEntity as Foo }` 의 경우 propertyName 이 원본명, name 이 alias.
        // 둘 중 하나라도 Entity 면 노출로 본다 (재export/사용 가능성).
        const original = element.propertyName?.text ?? element.name.text;
        if (isEntityName(original) || isEntityName(element.name.text)) return true;
      }
    }
  }

  // 2) 본문 type reference 검사.
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isImportDeclaration(node)) return;
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName;
      if (ts.isIdentifier(typeName)) {
        if (isEntityName(typeName.text)) {
          found = true;
          return;
        }
      } else if (ts.isQualifiedName(typeName)) {
        // `ns.FooEntity` — 가장 우측 식별자가 Entity 면 노출.
        let cursor: ts.EntityName = typeName;
        while (ts.isQualifiedName(cursor)) cursor = cursor.right;
        if (ts.isIdentifier(cursor) && isEntityName(cursor.text)) {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) continue;
    visit(statement);
    if (found) break;
  }
  return found;
}

/**
 * BFF 파일이 영속 쓰기 (`.save(...)` 류) 를 직접 수행하는지 AST 로 분석한다.
 *
 * substring 검사는 주석/문자열 리터럴 안의 ".save(" 도 잡았다 (false positive).
 * 본 분석은 method call expression (`x.save(...)` 또는 `x[ "save" ](...)`) 형태로
 * 호출이 발생하는 경우만 검출한다. 변수명이 "save" 를 포함해도 호출이 없으면
 * 통과한다.
 */
function analyzeBffPersistenceWrite(file: SourceFileInput): boolean {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === "save") {
        // `repo.save(...)`, `this.repository.save(...)` 등.
        found = true;
        return;
      }
      if (ts.isElementAccessExpression(expr)) {
        // `repo["save"](...)` 형태도 호출 의도.
        const arg = expr.argumentExpression;
        if (arg && ts.isStringLiteralLike(arg) && arg.text === "save") {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of sourceFile.statements) {
    visit(statement);
    if (found) break;
  }
  return found;
}

/**
 * OpenAPI fragment (yaml/json) 가 도메인 Entity 를 노출하는지 분석한다.
 *
 * substring 검사는 description/title/example 등 어떤 문자열이든 "Entity" 가
 * 들어가면 트리거되어 false positive 가 컸다. 본 분석은 schema 이름 (식별자)
 * 위치만 본다:
 *
 * - `components.schemas.<Name>` 의 Name.
 * - `definitions.<Name>` (Swagger 2.0 호환) 의 Name.
 *
 * Name 이 `Entity` 또는 `*Entity` 로 끝나면 노출로 판정. description 본문, tag 이름,
 * operationId, example 값 등은 검사하지 않는다. JSON parse 실패 시 false (다른
 * governance check 가 잡는다).
 */
function analyzeOpenApiEntityExposure(file: SourceFileInput): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;

  const isEntityName = (name: string): boolean => name === "Entity" || name.endsWith("Entity");

  const root = parsed as Record<string, unknown>;
  const schemaContainers: Array<Record<string, unknown> | undefined> = [];
  const components = root.components;
  if (components && typeof components === "object") {
    const schemas = (components as Record<string, unknown>).schemas;
    if (schemas && typeof schemas === "object") {
      schemaContainers.push(schemas as Record<string, unknown>);
    }
  }
  const definitions = root.definitions;
  if (definitions && typeof definitions === "object") {
    schemaContainers.push(definitions as Record<string, unknown>);
  }

  for (const container of schemaContainers) {
    if (!container) continue;
    for (const name of Object.keys(container)) {
      if (isEntityName(name)) return true;
    }
  }
  return false;
}

/**
 * import set 과 사용처 set 의 교집합에서 predicate 를 만족하는 식별자가 있는지 본다.
 */
function anyMatch(
  imported: ReadonlySet<string>,
  used: ReadonlySet<string>,
  predicate: (name: string) => boolean,
): boolean {
  for (const name of imported) {
    if (!predicate(name)) continue;
    if (used.has(name)) return true;
  }
  return false;
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
