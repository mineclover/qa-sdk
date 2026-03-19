/**
 * qa-sdk CLI — DSL 접근 도구.
 *
 * CLI는 시스템을 제어하지 않는다.
 * 외부 상태를 관찰(scan)하고, DSL로 기술(register)하고,
 * 변경을 시뮬레이션(dry-run)하고, 인터페이스를 생성(codegen)한다.
 *
 * 실제 version bump, build, deploy는 각 환경의 도구가 수행한다.
 * CLI는 그 결과를 수집하여 일관적 인터페이스로 관리할 뿐이다.
 */

import { parseArgs } from "node:util";
import { gitScan } from "./commands/git-scan.js";
import { register } from "./commands/register.js";
import { dryRun, type ChangeScenario } from "./commands/dry-run.js";
import { schemaPull } from "./commands/schema-pull.js";
import { codegen, type CodegenFormat } from "./commands/codegen.js";
import { specList, specResolve, specValidate, specTrace, specDecode, specCodegen } from "./commands/spec.js";

// ── Usage ────────────────────────────────────────────

const USAGE = `
qa-sdk — DSL 접근 도구

Usage:
  qa-sdk scan git [options]          Git 메타데이터 수집 → SchemaSnapshot
  qa-sdk register [options]          SchemaSnapshot → Registry 등록
  qa-sdk dry-run [options]           변경 시뮬레이션 (DAG 전파, 변경 없음)
  qa-sdk codegen [options]           SchemaSnapshot → 타입 인터페이스 생성
  qa-sdk inspect [options]           Registry 상태 조회
  qa-sdk spec list [options]         Prefix spec 목록 + schema + spec docs
  qa-sdk spec resolve <prefix> ...   Export title 생성
  qa-sdk spec validate <schema> ...  스키마 검증
  qa-sdk spec trace <specId>         추적성 경로 조회
  qa-sdk spec decode <addr>          주소 → 제목 변환 (decode→entries→export)
  qa-sdk spec codegen [options]      코드 생성 (ts|esm|cjs|proto|json-schema)

Commands:

  scan git
    --root <path>          모노레포 루트 (기본: .)
    --output <dir>         저장 디렉토리 (기본: ./schemas)
    --id <name>            스키마 ID (기본: repo 이름에서 추출)

  register
    --registry <url>       Registry 서버 URL ($QA_REGISTRY_URL)
    --input <path>         SchemaSnapshot (파일 또는 디렉토리, 기본: ./schemas)
    --version-id <id>      등록할 버전 ID (필수)

  dry-run
    --input <path>         기준 SchemaSnapshot (로컬 시뮬레이션)
    --change <json>        변경 시나리오 JSON
    --registry <url>       Registry 기준 (원격 시뮬레이션)

  codegen
    --format <fmt>         출력 형식: proto, ts (기본: ts)
    --input <path>         SchemaSnapshot (파일 또는 디렉토리, 기본: ./schemas)
    --output <dir>         출력 디렉토리 (기본: ./generated)
    --package <name>       protobuf package 이름 (기본: qa.apm.v1)

  inspect
    --registry <url>       Registry 서버 URL ($QA_REGISTRY_URL)
    --snapshot-id <id>     특정 스냅샷 ID (생략 시 active)
    --output <dir>         저장 디렉토리 (기본: ./schemas)
`.trim();

// ── Main ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return;
  }

  const sub = resolveSubcommand(args);

  switch (sub.name) {
    case "scan git":
      return runScanGit(sub.rest);
    case "register":
      return runRegister(sub.rest);
    case "dry-run":
      return runDryRun(sub.rest);
    case "codegen":
      return runCodegen(sub.rest);
    case "inspect":
      return runInspect(sub.rest);
    case "spec list":
      return runSpecList(sub.rest);
    case "spec resolve":
      return runSpecResolve(sub.rest);
    case "spec validate":
      return runSpecValidate(sub.rest);
    case "spec trace":
      return runSpecTrace(sub.rest);
    case "spec decode":
      return runSpecDecode(sub.rest);
    case "spec codegen":
      return runSpecCodegen(sub.rest);
    default:
      console.error(`알 수 없는 명령: ${sub.name}`);
      console.log(USAGE);
      process.exit(1);
  }
}

// ── Subcommand 해석 ──────────────────────────────────

interface Subcommand {
  name: string;
  rest: string[];
}

function resolveSubcommand(args: string[]): Subcommand {
  // 2단어: "scan git", "spec list", "spec resolve", "spec validate"
  const twoWord = ["scan git", "spec list", "spec resolve", "spec validate", "spec trace", "spec decode", "spec codegen"];
  if (args.length >= 2) {
    const candidate = `${args[0]} ${args[1]}`;
    if (twoWord.includes(candidate)) {
      return { name: candidate, rest: args.slice(2) };
    }
  }
  // 1단어 커맨드
  const oneWord = ["register", "dry-run", "codegen", "inspect"];
  if (oneWord.includes(args[0])) {
    return { name: args[0], rest: args.slice(1) };
  }
  return { name: args.join(" "), rest: [] };
}

// ── scan git ─────────────────────────────────────────

async function runScanGit(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string", default: "." },
      output: { type: "string", default: "./schemas" },
      id: { type: "string" },
    },
    strict: true,
  });

  await gitScan({
    root: values.root!,
    output: values.output!,
    id: values.id,
  });
}

// ── register ─────────────────────────────────────────

async function runRegister(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      registry: { type: "string" },
      input: { type: "string", default: "./schemas" },
      "version-id": { type: "string" },
    },
    strict: true,
  });

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;
  if (!registryUrl) {
    console.error("--registry 또는 $QA_REGISTRY_URL 필요");
    process.exit(1);
  }

  const versionId = values["version-id"];
  if (!versionId) {
    console.error("--version-id 필수");
    process.exit(1);
  }

  await register({
    registry: registryUrl,
    input: values.input!,
    versionId,
  });
}

// ── dry-run ──────────────────────────────────────────

async function runDryRun(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: "string" },
      change: { type: "string" },
      registry: { type: "string" },
    },
    strict: true,
  });

  if (!values.change) {
    console.error("--change <json> 필수. 예: --change '{\"pkg\":{\"capacity\":128}}'");
    process.exit(1);
  }

  let changes: ChangeScenario;
  try {
    changes = JSON.parse(values.change) as ChangeScenario;
  } catch {
    console.error("--change JSON 파싱 실패");
    process.exit(1);
  }

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;

  await dryRun({
    input: values.input,
    registry: registryUrl,
    changes,
  });
}

// ── codegen ──────────────────────────────────────────

async function runCodegen(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      format: { type: "string", default: "ts" },
      input: { type: "string", default: "./schemas" },
      output: { type: "string", default: "./generated" },
      package: { type: "string", default: "qa.apm.v1" },
    },
    strict: true,
  });

  const formats = values.format!.split(",").map((f) => {
    const trimmed = f.trim();
    if (trimmed !== "proto" && trimmed !== "ts") {
      console.error(`지원하지 않는 format: ${trimmed} (proto | ts)`);
      process.exit(1);
    }
    return trimmed as CodegenFormat;
  });

  await codegen({
    formats,
    input: values.input!,
    output: values.output!,
    packageName: values.package,
  });
}

// ── inspect ──────────────────────────────────────────

async function runInspect(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      registry: { type: "string" },
      "snapshot-id": { type: "string" },
      output: { type: "string", default: "./schemas" },
    },
    strict: true,
  });

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;
  if (!registryUrl) {
    console.error("--registry 또는 $QA_REGISTRY_URL 필요");
    process.exit(1);
  }

  await schemaPull({
    registry: registryUrl,
    output: values.output!,
    snapshotId: values["snapshot-id"],
  });
}

// ── spec 공통: --catalog / --specs 파싱 ─────────────

const SPEC_BASE_OPTIONS = {
  specs: { type: "string" as const },
  catalog: { type: "boolean" as const, default: false },
};

async function loadCatalogInput(): Promise<unknown | undefined> {
  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    return DEMO_CATALOG;
  } catch {
    console.error("demo-snapshot 패키지를 로딩할 수 없습니다");
    process.exit(1);
  }
}

// ── spec list ───────────────────────────────────────

async function runSpecList(argv: string[]) {
  const { values } = parseArgs({ args: argv, options: { ...SPEC_BASE_OPTIONS }, strict: true });
  await specList({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
  });
}

// ── spec resolve ────────────────────────────────────

async function runSpecResolve(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, prefix: { type: "string" }, values: { type: "string" } },
    strict: true,
  });

  if (!values.prefix || !values.values) {
    console.error("--prefix <id> --values <json> 필수");
    console.error('예: qa-sdk spec resolve --catalog --prefix permission --values \'{"perm_svc":"40","role":"admin"}\'');
    process.exit(1);
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(values.values) as Record<string, string>;
  } catch {
    console.error("--values JSON 파싱 실패");
    process.exit(1);
  }

  await specResolve({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    prefixId: values.prefix,
    values: parsed,
  });
}

// ── spec validate ───────────────────────────────────

async function runSpecValidate(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, schema: { type: "string" }, data: { type: "string" } },
    strict: true,
  });

  if (!values.schema || !values.data) {
    console.error("--schema <id> --data <json> 필수");
    process.exit(1);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(values.data) as Record<string, unknown>;
  } catch {
    console.error("--data JSON 파싱 실패");
    process.exit(1);
  }

  await specValidate({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    schemaId: values.schema,
    data: parsed,
  });
}

// ── spec trace ──────────────────────────────────────

async function runSpecTrace(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, id: { type: "string" } },
    strict: true,
  });

  if (!values.id) {
    console.error("--id <specId> 필수");
    console.error("예: qa-sdk spec trace --id FEAT-003");
    process.exit(1);
  }

  await specTrace({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    specId: values.id,
  });
}

// ── spec codegen ────────────────────────────────────

async function runSpecCodegen(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, output: { type: "string" }, format: { type: "string", default: "ts" } },
    strict: true,
  });

  await specCodegen({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    output: values.output,
    format: values.format as "ts" | "esm" | "cjs" | "proto" | "json-schema",
  });
}

// ── spec decode ─────────────────────────────────────

async function runSpecDecode(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, address: { type: "string" }, deep: { type: "boolean", default: false }, format: { type: "string" } },
    strict: true,
  });

  if (!values.address) {
    console.error('--address "prefix:version:address" 필수');
    console.error("예: qa-sdk spec decode --catalog --address permission:v1:3");
    console.error("    qa-sdk spec decode --catalog --address permission:v1:3 --deep");
    process.exit(1);
  }

  await specDecode({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    address: values.address,
    deep: values.deep,
    format: values.format === "json" ? "json" : "text",
  });
}

// ── Entry ────────────────────────────────────────────

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
