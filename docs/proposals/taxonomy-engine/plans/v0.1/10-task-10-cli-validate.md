# Taxonomy Engine v0.1 — Task 10: CLI `tax validate` 명령

## 목적 ^purpose

v0.1의 CLI tax validate 명령 작업 원문을 보존한다.

## Task 10: CLI `tax validate` 명령

**Files:**
- Modify: `packages/cli/package.json` — `taxonomy-engine: workspace:*` 추가
- Create: `packages/cli/src/commands/taxonomy.ts`
- Create: `packages/cli/src/command-groups/taxonomy.commands.ts`
- Modify: `packages/cli/src/index.ts` — 3곳 wiring (import / dispatch table / TREE list)
- Create: `packages/cli/src/commands/taxonomy.test.ts`

- [ ] **Step 1: 의존 추가**

`packages/cli/package.json`의 dependencies에 추가:

```json
"taxonomy-engine": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: 실패하는 통합 테스트**

`packages/cli/src/commands/taxonomy.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cliTaxonomy } from "./taxonomy.js";

const GOOD_YAML = `
taxonomy: ok
version: 1
axes:
  scope:
    entries: [a, b]
    capacity: 4
`;

const BAD_YAML = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b, c, d]
    capacity: 4
`;

function writeTmp(name: string, content: string): string {
  const dir = join(tmpdir(), `tax-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

describe("cli tax validate", () => {
  it("OK yaml → exit 0", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", writeTmp("good.yaml", GOOD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it("warning yaml → exit 0 (warning은 통과)", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", writeTmp("warn.yaml", BAD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it("--strict 시 warning을 error로 → exit 1", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", "--strict", writeTmp("strict.yaml", BAD_YAML)]);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @qa-sdk/cli test taxonomy.test`
Expected: FAIL — `cliTaxonomy` 없음

- [ ] **Step 4: 명령 구현**

`packages/cli/src/commands/taxonomy.ts`:

```typescript
import { readFileSync } from "node:fs";
import { parse, validate } from "taxonomy-engine";
import type { Diagnostic } from "taxonomy-engine";

export async function cliTaxonomy(rest: string[]): Promise<void> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "validate":
      return validateCmd(args);
    case "help":
    case undefined:
      printHelp();
      return;
    default:
      console.error(`알 수 없는 tax 명령: ${sub}`);
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`qa-sdk tax — 텍소노미 yaml 검증

사용법:
  qa-sdk tax validate <file> [--strict] [--json]
  qa-sdk tax help
`);
}

function validateCmd(args: string[]): void {
  const strict = args.includes("--strict");
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("파일 경로 필요: qa-sdk tax validate <file>");
    process.exit(1);
  }

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`파일 읽기 실패: ${file} — ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const parsed = parse(text);
  if ("error" in parsed) {
    printDiagnostics([parsed.error], { json, file });
    process.exit(1);
  }

  const diags = validate(parsed.ir, undefined, { strict });
  printDiagnostics(diags, { json, file });
  const errors = diags.filter((d) => d.severity === "error");
  if (errors.length > 0) process.exit(1);
}

function printDiagnostics(
  diags: Diagnostic[],
  opts: { json: boolean; file?: string },
): void {
  if (opts.json) {
    console.log(JSON.stringify(diags, null, 2));
    return;
  }

  if (diags.length === 0) {
    console.log("✔ 검증 통과 (errors=0, warnings=0)");
    return;
  }

  const errs = diags.filter((d) => d.severity === "error").length;
  const warns = diags.filter((d) => d.severity === "warning").length;
  console.log(`${errs > 0 ? "✖" : "⚠"} ${errs} errors, ${warns} warnings`);
  console.log("");
  for (const d of diags) {
    const tag = d.severity === "error" ? "ERR " : d.severity === "warning" ? "WARN" : "INFO";
    console.log(`  ${tag} ${d.code}`);
    if (d.ref) console.log(`       ${d.ref}`);
    console.log(`       ${d.message}`);
    if (d.hint) console.log(`       hint: ${d.hint}`);
    console.log("");
  }
}
```

- [ ] **Step 5: command-group 등록**

`packages/cli/src/command-groups/taxonomy.commands.ts`:

```typescript
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliTaxonomy } from "../commands/taxonomy.js";

export const TAXONOMY_COMMAND_DESCRIPTORS = [
  { id: "tax.help", path: ["help"], handlerKey: "tax.help" },
  { id: "tax.validate", path: ["validate"], handlerKey: "tax.validate" },
] as const satisfies readonly CommandDescriptor[];

export const TAXONOMY_COMMAND_TREE =
  descriptorsToTree(TAXONOMY_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const TAXONOMY_COMMAND_SPECS =
  collectCommandUsageSpecs(["tax"], TAXONOMY_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const TAXONOMY_TOP_LEVEL_USAGE_LINES = [
  "qa-sdk tax help                   도움말",
  "qa-sdk tax validate <file>         yaml 텍소노미 검증",
] as const;

export const TAXONOMY_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== "string" || !prop.startsWith("tax.")) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice(4);
      await cliTaxonomy([...subcommand.split("."), ...rest]);
    };
  },
});
```

- [ ] **Step 6: index.ts wiring (3곳)**

`packages/cli/src/index.ts` — DEF wiring 옆에 추가:

(a) import 블록 (DEF import 옆):

```typescript
import {
  TAXONOMY_COMMAND_SPECS as TAXONOMY_GROUP_COMMAND_SPECS,
  TAXONOMY_COMMAND_TREE as TAXONOMY_GROUP_COMMAND_TREE,
  TAXONOMY_HANDLER_REGISTRY as TAXONOMY_GROUP_HANDLER_REGISTRY,
  TAXONOMY_TOP_LEVEL_USAGE_LINES as TAXONOMY_GROUP_TOP_LEVEL_USAGE_LINES,
} from './command-groups/taxonomy.commands.js';
```

(b) usage 출력 (DEF 라인 옆):

```typescript
${formatUsageLines(TAXONOMY_GROUP_TOP_LEVEL_USAGE_LINES)}
```

(c) dispatch table (DEF dispatch 옆):

```typescript
async function dispatchTaxonomyCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(TAXONOMY_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}
```

(d) TREE 등록 list 안:

```typescript
{ rootSegments: ['tax'], rootName: 'qa-sdk tax', tree: TAXONOMY_GROUP_COMMAND_TREE, dispatch: dispatchTaxonomyCommand },
```

- [ ] **Step 7: 테스트 + 빌드 통과**

Run:
```bash
pnpm --filter @qa-sdk/cli test taxonomy.test
pnpm --filter @qa-sdk/cli build
```
Expected: 3 passed + 빌드 성공

- [ ] **Step 8: 실제 도그푸딩 yaml로 CLI 실행 확인**

Run:
```bash
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js tax validate docs/taxonomies/qa-sdk-coordinate-system.yaml
```
Expected: `✔ 검증 통과` 출력, exit 0

- [ ] **Step 9: 커밋**

```bash
git add packages/cli
git commit -m "feat(cli): add 'tax validate' command backed by taxonomy-engine (Task 10)"
```

---
