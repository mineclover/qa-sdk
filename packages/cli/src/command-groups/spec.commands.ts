import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
} from "../command-spec.js";
import {
  runSpecCodegen,
  runSpecDecode,
  runSpecList,
  runSpecResolve,
  runSpecTrace,
  runSpecValidate,
} from "../commands/spec.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const SPEC_COMMAND_DESCRIPTORS = [
  { id: "spec.list", path: ["list"], usage: "qa-sdk spec list [options]         Prefix spec 목록 + schema + spec docs", handlerKey: "spec.list" },
  { id: "spec.resolve", path: ["resolve"], usage: "qa-sdk spec resolve <prefix> ...   Export title 생성", handlerKey: "spec.resolve" },
  { id: "spec.validate", path: ["validate"], usage: "qa-sdk spec validate <schema> ...  스키마 검증", handlerKey: "spec.validate" },
  { id: "spec.trace", path: ["trace"], usage: "qa-sdk spec trace <specId>         추적성 경로 조회", handlerKey: "spec.trace" },
  { id: "spec.decode", path: ["decode"], usage: "qa-sdk spec decode <addr>          주소 → 제목 변환 (decode→entries→export)", handlerKey: "spec.decode" },
  { id: "spec.codegen", path: ["codegen"], usage: "qa-sdk spec codegen [options]      코드 생성 (ts|esm|cjs|proto|json-schema)", handlerKey: "spec.codegen" },
] as const satisfies readonly CommandDescriptor[];

export const SPEC_COMMAND_TREE =
  descriptorsToTree(SPEC_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const SPEC_COMMAND_SPECS =
  collectCommandUsageSpecs(["spec"], SPEC_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const SPEC_HANDLER_REGISTRY = {
  "spec.list": runSpecList,
  "spec.resolve": runSpecResolve,
  "spec.validate": runSpecValidate,
  "spec.trace": runSpecTrace,
  "spec.decode": runSpecDecode,
  "spec.codegen": runSpecCodegen,
} satisfies Readonly<Record<string, RestCommandHandler>>;
