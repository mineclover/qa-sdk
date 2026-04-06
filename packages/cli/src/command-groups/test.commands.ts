import { parseArgs } from "node:util";
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { testAssign, testReport, testScan, testScaffold, testStatus } from "../commands/test.js";

export const TEST_COMMAND_DESCRIPTORS = [
  { id: "test.scan", path: ["scan"], usage: "qa-sdk test scan [--dir <path>] [--db <path>]   스펙 frontmatter tests: 선언 → declared", handlerKey: "test.scan" },
  { id: "test.assign", path: ["assign"], usage: "qa-sdk test assign [--a-coord <c>] [--force] [--db <path>]  모듈화 체크 → B 좌표 부여", handlerKey: "test.assign" },
  { id: "test.scaffold", path: ["scaffold"], usage: "qa-sdk test scaffold [--b-coord <c>] [--db <path>]         테스트 스텁 파일 생성", handlerKey: "test.scaffold" },
  { id: "test.status", path: ["status"], usage: "qa-sdk test status [--db <path>]                 생명주기 현황", handlerKey: "test.status" },
  { id: "test.report", path: ["report"], usage: "qa-sdk test report [--db <path>]                 커버리지 매트릭스", handlerKey: "test.report" },
] as const satisfies readonly CommandDescriptor[];

export const TEST_COMMAND_TREE =
  descriptorsToTree(TEST_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const TEST_COMMAND_SPECS =
  collectCommandUsageSpecs(["test"], TEST_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const TEST_HANDLER_REGISTRY = {
  "test.scan": (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: { dir: { type: "string" }, db: { type: "string" } },
      strict: false,
    });
    testScan({ dir: values.dir as string | undefined, db: values.db as string | undefined });
  },
  "test.assign": (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: {
        "a-coord": { type: "string" },
        force: { type: "boolean" },
        db: { type: "string" },
      },
      strict: false,
    });
    testAssign({
      aCoord: values["a-coord"] as string | undefined,
      force: values.force as boolean | undefined,
      db: values.db as string | undefined,
    });
  },
  "test.scaffold": (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: { "b-coord": { type: "string" }, mirror: { type: "string" }, db: { type: "string" } },
      strict: false,
    });
    testScaffold({
      bCoord: values["b-coord"] as string | undefined,
      mirror: values.mirror as string | undefined,
      db: values.db as string | undefined,
    });
  },
  "test.status": (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: { db: { type: "string" } },
      strict: false,
    });
    testStatus({ db: values.db as string | undefined });
  },
  "test.report": (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: { db: { type: "string" } },
      strict: false,
    });
    testReport({ db: values.db as string | undefined });
  },
} satisfies Readonly<Record<string, RestCommandHandler>>;
