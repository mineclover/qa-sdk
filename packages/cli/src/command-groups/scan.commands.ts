// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { parseArgs } from "node:util";
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
} from "../command-spec.js";
import { gitScan } from "../commands/git-scan.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const SCAN_COMMAND_DESCRIPTORS = [
  {
    id: "scan.git",
    path: ["git"],
    usage: "qa-sdk scan git [options]          Git 메타데이터 수집 → SchemaSnapshot",
    handlerKey: "scan.git",
    options: [
      { flag: "--root", valueHint: "<path>", type: "string", description: "모노레포 루트 (기본: .)" },
      { flag: "--output", valueHint: "<dir>", type: "string", description: "저장 디렉토리 (기본: ./schemas)" },
      { flag: "--id", valueHint: "<name>", type: "string", description: "스키마 ID (기본: repo 이름에서 추출)" },
    ],
  },
] as const satisfies readonly CommandDescriptor[];

export const SCAN_COMMAND_TREE =
  descriptorsToTree(SCAN_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const SCAN_COMMAND_SPECS =
  collectCommandUsageSpecs(["scan"], SCAN_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const SCAN_HANDLER_REGISTRY = {
  "scan.git": async (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: {
        root: { type: "string", default: "." },
        output: { type: "string", default: "./schemas" },
        id: { type: "string" },
      },
      strict: true,
    });
    await gitScan({
      root: values.root ?? ".",
      output: values.output ?? "./schemas",
      id: values.id,
    });
  },
} satisfies Readonly<Record<string, RestCommandHandler>>;
