import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
} from "../command-spec.js";
import { gateCheck, gateClassify, gateHealth } from "../commands/service-query.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const GATE_COMMAND_DESCRIPTORS = [
  {
    id: "gate.health",
    path: ["health"],
    usage: "qa-sdk gate health [options]",
    description: "gate-service 헬스체크",
    options: [
      { flag: "--gate", valueHint: "<url>", type: "string", description: "Gate 서버 URL 오버라이드" },
    ],
    handlerKey: "gate.health",
  },
  {
    id: "gate.check",
    path: ["check"],
    usage: "qa-sdk gate check <prefix> [version] [options]",
    description: "주소 상태 확인",
    args: [
      { name: "prefix", required: true, description: "Prefix ID" },
      { name: "version", description: "버전 (기본: latest)" },
    ],
    options: [
      { flag: "--gate", valueHint: "<url>", type: "string", description: "Gate 서버 URL 오버라이드" },
    ],
    handlerKey: "gate.check",
  },
  {
    id: "gate.classify",
    path: ["classify"],
    usage: "qa-sdk gate classify <prefix> <version> <address> [options]",
    description: "주소 분류",
    args: [
      { name: "prefix", required: true, description: "Prefix ID" },
      { name: "version", required: true, description: "버전" },
      { name: "address", required: true, description: "디코딩된 주소 (숫자)" },
    ],
    options: [
      { flag: "--gate", valueHint: "<url>", type: "string", description: "Gate 서버 URL 오버라이드" },
    ],
    handlerKey: "gate.classify",
  },
] as const satisfies readonly CommandDescriptor[];

export const GATE_COMMAND_TREE =
  descriptorsToTree(GATE_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const GATE_COMMAND_SPECS =
  collectCommandUsageSpecs(["gate"], GATE_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const GATE_HANDLER_REGISTRY = {
  "gate.health": gateHealth,
  "gate.check": gateCheck,
  "gate.classify": gateClassify,
} satisfies Readonly<Record<string, RestCommandHandler>>;
