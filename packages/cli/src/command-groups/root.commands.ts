import { parseArgs } from "node:util";
import type { Catalog } from "@qa-sdk/core";
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
} from "../command-spec.js";
import { init } from "../commands/init.js";
import { register } from "../commands/register.js";
import { dryRun, type ChangeScenario } from "../commands/dry-run.js";
import { codegen, codegenDataObjects, runMigrationTest } from "../commands/codegen.js";
import { schemaPull } from "../commands/schema-pull.js";
import { syncObsidian } from "../commands/sync-obsidian.js";
import {
  cliEncode,
  cliDecode,
  cliResolve,
  cliFindVersion,
  cliListPrefixes,
  cliListAxes,
  cliDeriveRefs,
  cliImpact,
} from "../commands/dx.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const ROOT_COMMAND_DESCRIPTORS = [
  {
    id: "root.init",
    path: ["init"],
    usage: "qa-sdk init [options]            새 카탈로그 프로젝트 또는 Vite 소비처 스캐폴딩",
    handlerKey: "root.init"
  },
  {
    id: "root.register",
    path: ["register"],
    usage: "qa-sdk register [options]          SchemaSnapshot → Registry 등록",
    handlerKey: "root.register",
    options: [
      { flag: "--registry", valueHint: "<url>", description: "Registry 서버 URL ($QA_REGISTRY_URL)" },
      { flag: "--input", valueHint: "<path>", description: "SchemaSnapshot (파일 또는 디렉토리, 기본: ./schemas)" },
      { flag: "--version-id", valueHint: "<id>", description: "등록할 버전 ID (필수)" },
    ],
  },
  {
    id: "root.dry-run",
    path: ["dry-run"],
    usage: "qa-sdk dry-run [options]           변경 시뮬레이션 (DAG 전파, 변경 없음)",
    handlerKey: "root.dry-run",
    options: [
      { flag: "--catalog", valueHint: "<path>", description: "Catalog 파일 경로 (미지정 시 자동 탐색)" },
      { flag: "--change", valueHint: "<json>", description: "변경 시나리오 JSON" },
      { flag: "--registry", valueHint: "<url>", description: "Registry 기준 (원격 시뮬레이션)" },
    ],
  },
  {
    id: "root.codegen",
    path: ["codegen"],
    usage: "qa-sdk codegen [options]           SchemaSnapshot → 타입 인터페이스 생성",
    handlerKey: "root.codegen",
    options: [
      { flag: "--catalog", valueHint: "<path>", description: "Catalog 파일 경로 (TS/JS/JSON)" },
      { flag: "--registry", valueHint: "<url>", description: "Registry URL (원격 카탈로그)" },
      { flag: "--output", valueHint: "<dir>", description: "출력 디렉토리 (기본: ./generated)" },
    ],
  },
  {
    id: "root.inspect",
    path: ["inspect"],
    usage: "qa-sdk inspect [options]           Registry 상태 조회",
    handlerKey: "root.inspect",
    options: [
      { flag: "--registry", valueHint: "<url>", description: "Registry 서버 URL ($QA_REGISTRY_URL)" },
      { flag: "--snapshot-id", valueHint: "<id>", description: "특정 스냅샷 ID (생략 시 active)" },
      { flag: "--output", valueHint: "<dir>", description: "저장 디렉토리 (기본: ./schemas)" },
    ],
  },
  {
    id: "root.sync-obsidian",
    path: ["sync-obsidian"],
    usage: "qa-sdk sync-obsidian [options]     CATALOG → Obsidian 볼트 전체 동기화",
    handlerKey: "root.sync-obsidian",
    options: [
      { flag: "--vault", valueHint: "<name>", description: "대상 Obsidian 볼트 (기본: spec-prefix)" },
      { flag: "--dry-run", description: "미리보기 (실제 쓰기 없음)" },
    ],
  },
  { id: "root.encode", path: ["encode"], usage: "qa-sdk encode <prefix> [--dim val] 문자열 → 주소 인코딩", handlerKey: "root.encode" },
  { id: "root.decode", path: ["decode"], usage: "qa-sdk decode <addr>               주소 → 문자열 디코딩", handlerKey: "root.decode" },
  { id: "root.resolve", path: ["resolve"], usage: "qa-sdk resolve <addr>              자동 마이그레이션", handlerKey: "root.resolve" },
  { id: "root.find-version", path: ["find-version"], usage: "qa-sdk find-version <axis> <entry> 문자열이 있는 버전 찾기", handlerKey: "root.find-version" },
  { id: "root.list-prefixes", path: ["list-prefixes"], usage: "qa-sdk list-prefixes [--json]      prefix 목록", handlerKey: "root.list-prefixes" },
  { id: "root.list-axes", path: ["list-axes"], usage: "qa-sdk list-axes [--json]          축 목록", handlerKey: "root.list-axes" },
  { id: "root.derive-refs", path: ["derive-refs"], usage: "qa-sdk derive-refs [--check]       refEntries 정합성", handlerKey: "root.derive-refs" },
  { id: "root.impact", path: ["impact"], usage: "qa-sdk impact --axis <id>          영향 분석", handlerKey: "root.impact" },
] as const satisfies readonly CommandDescriptor[];

export const ROOT_COMMAND_TREE =
  descriptorsToTree(ROOT_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

const ALL_ROOT_SPECS = collectCommandUsageSpecs([], ROOT_COMMAND_TREE);

export const ROOT_COMMAND_SPECS = ALL_ROOT_SPECS.filter(s =>
  ["init", "register", "dry-run", "codegen", "inspect", "sync-obsidian"].includes(s.name)
) as readonly CommandUsageSpec<string>[];

export const DX_COMMAND_SPECS = ALL_ROOT_SPECS.filter(s =>
  ["encode", "decode", "resolve", "find-version", "list-prefixes", "list-axes", "derive-refs", "impact"].includes(s.name)
) as readonly CommandUsageSpec<string>[];

export function createRootHandlerRegistry(
  loadedCatalog?: Catalog,
): Readonly<Record<string, RestCommandHandler>> {
  return {
    "root.init": async (rest) => {
      const { values } = parseArgs({
        args: rest,
        options: {
          from: { type: "string" },
          "vite-consumer": { type: "string" },
          "service-name": { type: "string" },
          "owner-id": { type: "string" },
          "build-env": { type: "string" },
          force: { type: "boolean", default: false },
        },
        strict: true,
      });
      await init({
        from: values.from,
        viteConsumer: values["vite-consumer"],
        serviceName: values["service-name"],
        ownerId: values["owner-id"],
        buildEnv: values["build-env"],
        force: values.force ?? false,
      });
    },
    "root.register": async (rest) => {
      const { values } = parseArgs({
        args: rest,
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
        input: values.input ?? "./schemas",
        versionId,
      });
    },
    "root.dry-run": async (rest) => {
      const { values } = parseArgs({
        args: rest,
        options: {
          catalog: { type: "string" },
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
        changes = JSON.parse(values.change);
      } catch {
        console.error("--change JSON 파싱 실패");
        process.exit(1);
      }
      const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;
      if (registryUrl) {
        await dryRun({ registry: registryUrl, changes });
      } else {
        await dryRun({ catalog: values.catalog, loadedCatalog, changes });
      }
    },
    "root.codegen": async (rest) => {
      const { values } = parseArgs({
        args: rest,
        options: {
          format: { type: "string", default: "ts" },
          input: { type: "string", default: "./schemas" },
          output: { type: "string", default: "./generated" },
          package: { type: "string", default: "qa.apm.v1" },
          catalog: { type: "string" },
          "dkg-config": { type: "string" },
          "lock-version": { type: "string" },
          registry: { type: "string" },
          "catalog-id": { type: "string" },
          "data-objects": { type: "string" },
          "test-migration": { type: "boolean" },
          prefix: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          samples: { type: "string" },
        },
        strict: true,
      });
      if (values["data-objects"]) {
        await codegenDataObjects({
          bindingsPath: values["data-objects"],
          output: values.output ?? "./generated",
        });
        return;
      }
      if (values["test-migration"]) {
        if (!values.prefix || !values.from || !values.to) {
          console.error("Usage: qa-sdk codegen --test-migration --prefix <id> --from <v1> --to <v2> [--samples 100]");
          return;
        }
        await runMigrationTest({
          loadedCatalog,
          catalog: values.catalog,
          prefix: values.prefix,
          from: values.from,
          to: values.to,
          samples: values.samples ? parseInt(values.samples) : undefined,
        });
        return;
      }
      if (values.registry) {
        await codegen({
          output: values.output ?? "./generated",
          registry: values.registry,
          catalogId: values["catalog-id"],
          dkgConfig: values["dkg-config"],
          lockVersion: values["lock-version"],
        });
        return;
      }
      await codegen({
        output: values.output ?? "./generated",
        catalog: values.catalog,
        loadedCatalog,
        dkgConfig: values["dkg-config"],
        lockVersion: values["lock-version"],
      });
    },
    "root.inspect": async (rest) => {
      const { values } = parseArgs({
        args: rest,
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
        output: values.output ?? "./schemas",
        snapshotId: values["snapshot-id"],
      });
    },
    "root.sync-obsidian": (rest) => {
      const { values } = parseArgs({
        args: rest,
        options: {
          vault: { type: "string", default: "spec-prefix" },
          "dry-run": { type: "boolean", default: false },
        },
        strict: true,
      });
      syncObsidian({
        vault: values.vault ?? "spec-prefix",
        dryRun: values["dry-run"] ?? false,
      });
    },
    "root.encode": (rest) => {
      const prefix = rest[0];
      if (!prefix) {
        console.error("Usage: qa-sdk encode <prefix> --dim1 val1 --dim2 val2");
        return;
      }
      const dims: Record<string, string | number> = {};
      for (let i = 1; i < rest.length; i += 2) {
        const key = rest[i]?.replace(/^--/, "");
        const val = rest[i + 1];
        if (key && val) dims[key] = val;
      }
      const json = rest.includes("--json");
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      cliEncode(loadedCatalog, { prefix, dims, json });
    },
    "root.decode": (rest) => {
      const address = rest[0];
      if (!address) {
        console.error("Usage: qa-sdk decode \"prefix:version:address\"");
        return;
      }
      const deep = rest.includes("--deep");
      const json = rest.includes("--json");
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      cliDecode(loadedCatalog, { address, deep, json });
    },
    "root.resolve": (rest) => {
      const address = rest[0];
      if (!address) {
        console.error("Usage: qa-sdk resolve \"prefix:version:address\"");
        return;
      }
      const json = rest.includes("--json");
      const toIdx = rest.indexOf("--to");
      const to = toIdx >= 0 ? rest[toIdx + 1] : undefined;
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      cliResolve(loadedCatalog, { address, to, json });
    },
    "root.find-version": (rest) => {
      const axis = rest[0];
      const entry = rest[1];
      if (!axis || !entry) {
        console.error("Usage: qa-sdk find-version <axis> <entry>");
        return;
      }
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      cliFindVersion(loadedCatalog, { axis, entry });
    },
    "root.list-prefixes": (rest) => {
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      cliListPrefixes(loadedCatalog, { json: rest.includes("--json") });
    },
    "root.list-axes": (rest) => {
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      cliListAxes(loadedCatalog, { json: rest.includes("--json") });
    },
    "root.derive-refs": (rest) => {
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      cliDeriveRefs(loadedCatalog, { check: true });
    },
    "root.impact": async (rest) => {
      const axisIdx = rest.indexOf("--axis");
      const prefixIdx = rest.indexOf("--prefix");
      const { DEMO_DKG_CONFIG } = await import("demo-snapshot");
      const dkgConfig = DEMO_DKG_CONFIG;
      if (!loadedCatalog) { console.error("카탈로그 로딩 실패"); return; }
      if (axisIdx >= 0) cliImpact(loadedCatalog, dkgConfig, { axis: rest[axisIdx + 1] });
      else if (prefixIdx >= 0) cliImpact(loadedCatalog, dkgConfig, { prefix: rest[prefixIdx + 1] });
      else console.error("Usage: qa-sdk impact --axis <id> or --prefix <id>");
    },
  };
}
