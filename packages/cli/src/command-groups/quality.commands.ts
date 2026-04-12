import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliQuality } from "../commands/quality.js";

export const QUALITY_COMMAND_DESCRIPTORS = [
  { id: "quality.root", path: ["quality"], handlerKey: "quality.list" },
  { id: "quality.list", path: ["quality", "list"], usage: "qa-sdk quality list [filters]      gate 문서 목록", handlerKey: "quality.list" },
  { id: "quality.status", path: ["quality", "status"], usage: "qa-sdk quality status [bundle-id]  quality bundle 상태 요약", handlerKey: "quality.status" },
  { id: "quality.export", path: ["quality", "export"], usage: "qa-sdk quality export [bundle-id] [--output=<path>] [--artifact-registry=<file>]  quality bundle 상태 JSON export", handlerKey: "quality.export" },
  { id: "quality.bundle", path: ["quality", "bundle"], usage: "qa-sdk quality bundle <bundle-id>  gate 번들 문서 조회", handlerKey: "quality.bundle" },
  { id: "quality.claims", path: ["quality", "claims"], usage: "qa-sdk quality claims <bundle-id>  contract claim 감사표 조회", handlerKey: "quality.claims" },
  { id: "quality.show", path: ["quality", "show"], usage: "qa-sdk quality show <gate-id>      gate 문서 상세", handlerKey: "quality.show" },
  { id: "quality.run", path: ["quality", "run"], usage: "qa-sdk quality run <gate-id>       gate 명령 실행", handlerKey: "quality.run" },
  { id: "quality.next", path: ["quality", "next"], usage: "qa-sdk quality next <gate-id>      다음 gate/doc 추천", handlerKey: "quality.next" },
  { id: "quality.diagnose", path: ["quality", "diagnose"], usage: "qa-sdk quality diagnose <gate-id>  최근 실패/검증 상태 진단", handlerKey: "quality.diagnose" },
] as const satisfies readonly CommandDescriptor[];

export const QUALITY_COMMAND_TREE =
  descriptorsToTree(QUALITY_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const QUALITY_COMMAND_SPECS =
  collectCommandUsageSpecs([], QUALITY_COMMAND_TREE) as readonly CommandUsageSpec<string>[];


export const QUALITY_HANDLER_REGISTRY = {
  "quality.list": async (rest: string[]) => cliQuality(["list", ...rest]),
  "quality.status": async (rest: string[]) => cliQuality(["status", ...rest]),
  "quality.export": async (rest: string[]) => cliQuality(["export", ...rest]),
  "quality.bundle": async (rest: string[]) => cliQuality(["bundle", ...rest]),
  "quality.claims": async (rest: string[]) => cliQuality(["claims", ...rest]),
  "quality.show": async (rest: string[]) => cliQuality(["show", ...rest]),
  "quality.run": async (rest: string[]) => cliQuality(["run", ...rest]),
  "quality.next": async (rest: string[]) => cliQuality(["next", ...rest]),
  "quality.diagnose": async (rest: string[]) => cliQuality(["diagnose", ...rest]),
} satisfies Readonly<Record<string, RestCommandHandler>>;
