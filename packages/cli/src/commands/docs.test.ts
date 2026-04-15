import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cliDocs } from "./docs.js";

describe("docs commands", () => {
  let rootDir = "";

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
    rootDir = "";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  async function createFixtureWorkspace(): Promise<string> {
    rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-docs-cli-"));
    await mkdir(join(rootDir, "docs/specs/checkout"), { recursive: true });
    await mkdir(join(rootDir, "packages/cli/src/commands"), { recursive: true });
    await mkdir(join(rootDir, "tasks"), { recursive: true });
    await mkdir(join(rootDir, ".ralph-tui"), { recursive: true });
    await mkdir(join(rootDir, "artifacts"), { recursive: true });

    await writeFile(join(rootDir, "pnpm-workspace.yaml"), "packages: []\n");
    await writeFile(join(rootDir, "docs/specs/checkout/checkout.spec.md"), `---
def:
  id: checkout-spec
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [checkout, docs]
  links:
    - target: checkout-plan
      type: depends_on
source: packages/checkout/src/index.ts:Checkout
---
# Checkout Spec

## 목적 ^purpose

Coordinate checkout documentation state.

Completed: remove obsolete checkout stub.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout.todo.md"), `---
def:
  id: checkout-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
  tags: [checkout]
---
# Checkout Todo

## 목적 ^purpose

Follow up on checkout implementation evidence.

## Tasks

- [ ] Remove obsolete checkout stub.
- [ ] Sync PRD completion ledger.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout.plan.md"), `---
def:
  id: checkout-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
  tags: [checkout]
---
# Checkout Plan

## 목적 ^purpose

Plan checkout adapter follow-up work.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout-group.spec.md"), `---
def:
  id: checkout-group
  level: group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
---
# Checkout Group

## 목적 ^purpose

Groups checkout docs.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout-scenario-matrix.spec.md"), `---
def:
  id: checkout-scenario-matrix
  level: leaf
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: draft
source: packages/cli/src/commands/docs.test.ts
---
# Checkout Scenario Matrix

## 목적 ^purpose

Document checkout drift evidence references.

## Scenario Matrix

| row | evidence |
|-----|----------|
| checkout drift | \`E-CHECKOUT-DRIFT\` |

## Evidence References

- \`E-CHECKOUT-DRIFT\`: [\`packages/cli/src/commands/docs.test.ts\`](../../../packages/cli/src/commands/docs.test.ts) test title \`stale checkout drift test title\`.
`);

    await writeFile(join(rootDir, "packages/cli/src/commands/docs.test.ts"), `import { it } from "vitest";

it("current checkout drift test title", () => {});
`);

    await writeFile(join(rootDir, "tasks/checkout-prd.md"), `[PRD]
# PRD: Checkout PRD

## Overview

Coordinate checkout adapters.

## Goals

- Inspect checkout docs.

## Quality Gates

- \`pnpm --filter @qa-sdk/cli test -- docs\` passes.

## User Stories

### US-001: Complete checkout docs

**Description:** As a maintainer, I want complete checkout docs.

**Acceptance Criteria:**
- [x] Status output exists.
- [ ] JSON output exists.

## Functional Requirements

- FR-1: Search covers PRD markdown.

## Non-Goals

- Mutating source documents.

## Open Questions

- None.
[/PRD]
`);

    await writeFile(join(rootDir, "tasks/checkout-prd.json"), JSON.stringify({
      name: "Checkout PRD",
      branchName: "ralph/checkout-docs",
      description: "Coordinate checkout adapters.",
      userStories: [
        {
          id: "US-001",
          title: "Complete checkout docs",
          description: "As a maintainer, I want complete checkout docs.",
          acceptanceCriteria: [
            "Status output exists.",
            "`pnpm --filter @qa-sdk/cli test -- docs` passes.",
          ],
          priority: 1,
          passes: true,
          notes: "Completed: sync PRD completion ledger.",
          dependsOn: [],
          completionNotes: "Completed by agent",
        },
      ],
    }, null, 2));

    await writeFile(join(rootDir, "tasks/unrelated-prd.json"), JSON.stringify({
      name: "Unrelated PRD",
      branchName: "ralph/unrelated",
      description: "Shares quality gate text but must not be related to the target status.",
      metadata: {
        owner: "unrelated-domain",
      },
      userStories: [],
    }, null, 2));

    await writeFile(join(rootDir, ".ralph-tui/session-meta.json"), JSON.stringify({
      id: "session-1",
      status: "running",
      prdPath: "tasks/checkout-prd.json",
      totalTasks: 1,
      tasksCompleted: 1,
    }, null, 2));

    await writeFile(join(rootDir, "artifacts/programming-artifacts.json"), JSON.stringify({
      artifacts: [
        {
          artifactId: "checkout-evidence",
          kind: "activation-evidence",
          artifactRef: "artifacts/checkout-evidence.json",
          outputPath: "artifacts/checkout-evidence.json",
          ownerDefinitionId: "checkout-spec",
          sourceRefs: ["docs/specs/checkout/checkout.spec.md"],
          verificationRefs: ["packages/cli/src/commands/docs.test.ts"],
          relations: [
            {
              kind: "verifies",
              fromRef: "checkout-evidence",
              toRef: "checkout-spec",
            },
          ],
          metadata: {
            packId: "checkout-pack",
          },
        },
      ],
    }, null, 2));

    return rootDir;
  }

  async function createBlockedCompletionWorkspace(): Promise<string> {
    rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-docs-prd-sync-"));
    await mkdir(join(rootDir, "docs/specs/inventory"), { recursive: true });
    await mkdir(join(rootDir, "tasks"), { recursive: true });
    await mkdir(join(rootDir, ".ralph-tui"), { recursive: true });

    await writeFile(join(rootDir, "pnpm-workspace.yaml"), "packages: []\n");
    await writeFile(join(rootDir, "docs/specs/inventory/inventory.spec.md"), `---
def:
  id: inventory-spec
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [inventory]
---
# Inventory Spec

## 목적 ^purpose

Inventory completion behavior is still mismatched with TODO state.
`);

    await writeFile(join(rootDir, "docs/specs/inventory/inventory.todo.md"), `---
def:
  id: inventory-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
  tags: [inventory]
---
# Inventory Todo

## 목적 ^purpose

Track inventory completion follow-up.

## Tasks

- [ ] Document inventory completion evidence.
`);

    await writeFile(join(rootDir, "docs/specs/inventory/inventory-roadmap.plan.md"), `---
def:
  id: inventory-roadmap-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
  tags: [inventory]
---
# Inventory Roadmap

## 목적 ^purpose

Track inventory roadmap state.
`);

    await writeFile(join(rootDir, "docs/specs/inventory/inventory-scenario-matrix.spec.md"), `---
def:
  id: inventory-scenario-matrix
  level: leaf
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: draft
  tags: [inventory]
---
# Inventory Scenario Matrix

## 목적 ^purpose

Track inventory scenario coverage.

## Scenario Matrix

| row | evidence |
|-----|----------|
| inventory completion | Gap: evidence pending |
`);

    await writeFile(join(rootDir, "tasks/inventory-prd.json"), JSON.stringify({
      name: "Inventory Completion PRD",
      branchName: "ralph/inventory-completion",
      description: "Document inventory completion evidence.",
      userStories: [
        {
          id: "US-001",
          title: "Document inventory completion evidence",
          description: "As a docs operator, I want inventory completion docs synchronized.",
          acceptanceCriteria: [
            "Document inventory completion evidence.",
          ],
          priority: 1,
          passes: true,
          notes: "Completed by agent.",
          dependsOn: [],
          completionNotes: "Completed by agent.",
        },
      ],
    }, null, 2));

    await writeFile(join(rootDir, ".ralph-tui/session-meta.json"), JSON.stringify({
      id: "inventory-session",
      status: "completed",
      prdPath: "tasks/inventory-prd.json",
      totalTasks: 1,
      tasksCompleted: 1,
    }, null, 2));

    return rootDir;
  }

  function output(): string {
    return vi.mocked(console.log).mock.calls.map((call) => String(call[0])).join("\n");
  }

  function parsedOutput<T>(): T {
    return JSON.parse(output()) as T;
  }

  function errorOutput(): string {
    return vi.mocked(console.error).mock.calls.map((call) => String(call[0])).join("\n");
  }

  function parsedError<T>(): T {
    return JSON.parse(errorOutput()) as T;
  }

  it("prints text status and identifies todo follow-up state", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["status", "checkout-spec", "--root", workspace]);

    const text = output();
    expect(text).toContain("docs status: checkout-spec");
    expect(text).toContain("kind: spec");
    expect(text).toContain("next follow-up: draft todo");
    expect(text).toContain("docs/specs/checkout/checkout.todo.md");
  });

  it("prints JSON status with session follow-up state for PRD families", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["status", "tasks/checkout-prd", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      document: { stableId: string; kind: string };
      nextFollowUp: { source: string; kind: string; state: string; reason: string };
      counts: { familyMembers: number; tasks: number; diagnostics: number };
      diagnostics: Array<{ rawSource?: { path?: string } }>;
    }>();
    expect(result.document).toMatchObject({
      stableId: "tasks/checkout-prd",
      kind: "prd",
    });
    expect(result.nextFollowUp).toMatchObject({
      source: "ralph-session",
      kind: "ralph-session",
      state: "running",
    });
    expect(result.nextFollowUp.reason).toContain("session is still running");
    expect(result.counts.familyMembers).toBeLessThan(10);
    expect(result.counts.tasks).toBeGreaterThan(0);
    expect(result.counts.diagnostics).toBeGreaterThan(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.rawSource?.path)).not.toContain(
      "tasks/unrelated-prd.json",
    );
  });

  it("collects family members, metadata, links, sources, tasks, evidence, and diagnostics as JSON", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["collect", "checkout-spec", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      familyMembers: Array<{ stableId: string; kind: string }>;
      metadata: Array<{ stableId: string }>;
      links: Array<{ type: string; targetId: string }>;
      sources: Array<{ path?: string }>;
      tasks: unknown[];
      evidence: Array<{ id: string; kind?: string }>;
      diagnostics: unknown[];
    }>();
    expect(result.familyMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec", kind: "spec" }),
        expect.objectContaining({ stableId: "checkout-todo", kind: "todo" }),
        expect.objectContaining({ stableId: "checkout-evidence", kind: "activation-evidence" }),
      ]),
    );
    expect(result.metadata.map((item) => item.stableId)).toContain("checkout-spec");
    expect(result.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "depends_on", targetId: "checkout-plan" }),
        expect.objectContaining({ type: "verifies", targetId: "checkout-spec" }),
      ]),
    );
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "packages/checkout/src/index.ts" }),
        expect.objectContaining({ path: "docs/specs/checkout/checkout.spec.md" }),
      ]),
    );
    expect(result.tasks).toEqual([]);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "checkout-evidence", kind: "activation-evidence" }),
      ]),
    );
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it("searches definition markdown and PRD adapters with kind and metadata filters", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["search", "checkout", "--root", workspace, "--json"]);
    const allResults = parsedOutput<{
      results: Array<{ kind: string; stableId: string }>;
    }>();
    expect(allResults.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "spec", stableId: "checkout-spec" }),
        expect.objectContaining({ kind: "prd", stableId: "tasks/checkout-prd" }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "search",
      "checkout",
      "--root",
      workspace,
      "--kind",
      "prd",
      "--metadata",
      "sourcePath=tasks/checkout-prd.md",
      "--json",
    ]);
    const filteredResults = parsedOutput<{
      filters: { kinds: string[]; metadata: Record<string, string> };
      results: Array<{ kind: string; stableId: string }>;
    }>();
    expect(filteredResults.filters).toEqual({
      kinds: ["prd"],
      metadata: { sourcePath: "tasks/checkout-prd.md" },
    });
    expect(filteredResults.results).toEqual([
      expect.objectContaining({ kind: "prd", stableId: "tasks/checkout-prd" }),
    ]);
  });

  it("prints text search output", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["search", "Coordinate checkout", "--root", workspace]);

    const text = output();
    expect(text).toContain('docs search: "Coordinate checkout"');
    expect(text).toContain("[spec] checkout-spec");
    expect(text).toContain("[prd] tasks/checkout-prd");
  });

  it("reports docs drift grouped by severity with remediation hints", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["drift", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      counts: { total: number; error: number; warning: number };
      issuesBySeverity: {
        error: Array<{ code: string; path: string; remediation: string }>;
        warning: Array<{ code: string; path: string; remediation: string; metadata: Record<string, unknown> }>;
      };
    }>();
    expect(result.counts.total).toBeGreaterThanOrEqual(6);
    expect(result.counts.error).toBeGreaterThanOrEqual(2);
    expect(result.counts.warning).toBeGreaterThanOrEqual(4);
    expect(result.issuesBySeverity.error).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "document-source-reference-missing",
          path: "docs/specs/checkout/checkout.spec.md",
          remediation: expect.stringContaining("Create the referenced file"),
        }),
        expect.objectContaining({
          code: "definition-level-violation",
          path: "docs/specs/checkout/checkout-group.spec.md",
          remediation: expect.stringContaining("Add a contains link"),
        }),
      ]),
    );
    expect(result.issuesBySeverity.warning).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ralph-session-prd-complete-session-running",
          path: ".ralph-tui/session-meta.json",
          remediation: expect.stringContaining("Stop or archive"),
        }),
        expect.objectContaining({
          code: "prd-markdown-unchecked-after-json-complete",
          path: "tasks/checkout-prd.md",
          metadata: expect.objectContaining({ storyId: "US-001" }),
        }),
        expect.objectContaining({
          code: "todo-open-described-complete",
          path: "docs/specs/checkout/checkout.todo.md",
          remediation: expect.stringContaining("Check the TODO item"),
        }),
        expect.objectContaining({
          code: "todo-open-described-complete",
          path: "docs/specs/checkout/checkout.todo.md",
          metadata: expect.objectContaining({ completedInPath: "tasks/checkout-prd.json" }),
        }),
        expect.objectContaining({
          code: "scenario-matrix-test-title-missing",
          path: "docs/specs/checkout/checkout-scenario-matrix.spec.md",
          remediation: expect.stringContaining("Update the Evidence References test title"),
        }),
      ]),
    );
  });

  it("scopes docs drift to a PRD family when --prd is provided", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["drift", "--root", workspace, "--prd", "tasks/checkout-prd.json", "--json"]);

    const result = parsedOutput<{
      scope: { prd: string; documents: number };
      issues: Array<{ code: string; path: string }>;
    }>();
    expect(result.scope).toMatchObject({
      prd: "tasks/checkout-prd.json",
    });
    expect(result.scope.documents).toBeGreaterThanOrEqual(3);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ralph-session-prd-complete-session-running" }),
        expect.objectContaining({ code: "prd-markdown-unchecked-after-json-complete" }),
      ]),
    );
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "document-source-reference-missing" }),
        expect.objectContaining({ code: "definition-level-violation" }),
      ]),
    );
  });

  it("prints text drift output with severity groups and hints", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["drift", "--root", workspace]);

    const text = output();
    expect(text).toContain("docs drift:");
    expect(text).toContain("errors (");
    expect(text).toContain("warnings (");
    expect(text).toContain("[document-source-reference-missing] docs/specs/checkout/checkout.spec.md");
    expect(text).toContain("hint:");
  });

  it("collects PRD authoring context from docs control-plane sources", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["prd", "context", "checkout", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      counts: {
        relatedSpecs: number;
        openTodos: number;
        plans: number;
        priorPrds: number;
        prdJsonCompletion: number;
        ralphSessions: number;
        scenarioMatrixRows: number;
        sources: number;
        evidence: number;
      };
      relatedSpecs: Array<{ stableId: string; path: string }>;
      openTodos: Array<{ text: string; path: string }>;
      plans: Array<{ stableId: string }>;
      priorPrds: Array<{ stableId: string }>;
      prdJsonCompletion: Array<{ path: string; storyCount: number; passedStoryCount: number; allStoriesPassing: boolean }>;
      ralphSessionState: Array<{ status: string; prdPath: string }>;
      scenarioMatrixRows: Array<{ evidenceIds: string[] }>;
      sources: Array<{ path?: string; label?: string }>;
      evidence: Array<{ id: string; kind?: string }>;
      contextSources: Array<{ stableId: string; reason: string }>;
    }>();

    expect(result.counts.relatedSpecs).toBeGreaterThanOrEqual(2);
    expect(result.counts.openTodos).toBe(2);
    expect(result.counts.plans).toBeGreaterThanOrEqual(1);
    expect(result.counts.priorPrds).toBeGreaterThanOrEqual(1);
    expect(result.counts.prdJsonCompletion).toBeGreaterThanOrEqual(1);
    expect(result.counts.ralphSessions).toBeGreaterThanOrEqual(1);
    expect(result.counts.scenarioMatrixRows).toBeGreaterThanOrEqual(1);
    expect(result.counts.sources).toBeGreaterThanOrEqual(1);
    expect(result.counts.evidence).toBeGreaterThanOrEqual(1);
    expect(result.relatedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec", path: "docs/specs/checkout/checkout.spec.md" }),
      ]),
    );
    expect(result.openTodos.map((todo) => todo.text)).toEqual(
      expect.arrayContaining([
        "Remove obsolete checkout stub.",
        "Sync PRD completion ledger.",
      ]),
    );
    expect(result.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-plan" }),
      ]),
    );
    expect(result.priorPrds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "tasks/checkout-prd" }),
      ]),
    );
    expect(result.prdJsonCompletion).toEqual([
      expect.objectContaining({
        path: "tasks/checkout-prd.json",
        storyCount: 1,
        passedStoryCount: 1,
        allStoriesPassing: true,
      }),
    ]);
    expect(result.ralphSessionState).toEqual([
      expect.objectContaining({
        status: "running",
        prdPath: "tasks/checkout-prd.json",
      }),
    ]);
    expect(result.scenarioMatrixRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidenceIds: ["E-CHECKOUT-DRIFT"] }),
      ]),
    );
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "packages/checkout/src/index.ts" }),
      ]),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "checkout-evidence", kind: "activation-evidence" }),
      ]),
    );
    expect(result.contextSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec" }),
      ]),
    );
  });

  it("writes a markdown PRD scaffold with control-plane context sources", async () => {
    const workspace = await createFixtureWorkspace();
    const outputPath = join(workspace, "tasks/generated-checkout-prd.md");

    await cliDocs([
      "prd",
      "scaffold",
      "checkout",
      "--root",
      workspace,
      "--output",
      "tasks/generated-checkout-prd.md",
      "--json",
    ]);

    const result = parsedOutput<{
      output: string;
      bytes: number;
      context: { counts: { contextSources: number; openTodos: number; priorPrds: number } };
    }>();
    const content = await readFile(outputPath, "utf8");
    expect(result.output).toBe("tasks/generated-checkout-prd.md");
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.context.counts.contextSources).toBeGreaterThan(0);
    expect(result.context.counts.openTodos).toBe(2);
    expect(result.context.counts.priorPrds).toBeGreaterThanOrEqual(1);
    expect(content).toContain("[PRD]");
    expect(content).toContain("## Overview");
    expect(content).toContain("## Goals");
    expect(content).toContain("## Quality Gates");
    expect(content).toContain("## User Stories");
    expect(content).toContain("## Non-Goals");
    expect(content).toContain("## Technical Considerations");
    expect(content).toContain("## Success Metrics");
    expect(content).toContain("## Open Questions");
    expect(content).toContain("## Control-Plane Context Sources");
    expect(content).toContain("[spec] `checkout-spec`");
    expect(content).toContain("Creating PRD JSON from this scaffold");
  });

  it("converts PRD markdown to ralph JSON through control-plane adapters", async () => {
    const workspace = await createFixtureWorkspace();
    const outputPath = join(workspace, "tasks/conversion-prd.json");
    await writeFile(join(workspace, "tasks/conversion-prd.md"), `[PRD]
# PRD: Conversion PRD

## Overview

Convert markdown PRD state into ralph JSON. Inline marker text like \`[PRD]...[/PRD]\` is documentation content, not a block boundary.

## Quality Gates

- \`pnpm --filter @qa-sdk/cli test -- docs\` passes.
- \`pnpm --filter @qa-sdk/cli typecheck\` passes.

## User Stories

### US-001: Build source adapter path

**Description:** As a maintainer, I want markdown parsing to stay adapter-owned.

**Acceptance Criteria:**
- [ ] PRD markdown is read through the adapter.

### US-002: Write generated JSON

**Description:** As a ralph user, I want a compatible JSON file.

**Acceptance Criteria:**
- [ ] The output is a flat ralph root.

### US-003: Validate generated JSON

**Description:** As a reviewer, I want schema anti-pattern validation before the file is written.

**Depends on:** US-001

**Acceptance Criteria:**
- [ ] The generated JSON is validated by the ralph adapter.
[/PRD]
`);

    await cliDocs([
      "prd",
      "to-ralph-json",
      "tasks/conversion-prd.md",
      "--root",
      workspace,
      "--output",
      "tasks/conversion-prd.json",
      "--json",
    ]);

    const result = parsedOutput<{
      input: string;
      output: string;
      storyCount: number;
      diagnostics: unknown[];
      root: {
        name: string;
        branchName: string;
        description: string;
        userStories: Array<{
          id: string;
          acceptanceCriteria: string[];
          priority: number;
          passes: boolean;
          notes: string;
          dependsOn: string[];
          status?: string;
        }>;
      };
    }>();
    const content = await readFile(outputPath, "utf8");
    const generated = JSON.parse(content) as typeof result.root;
    expect(result.input).toBe("tasks/conversion-prd.md");
    expect(result.output).toBe("tasks/conversion-prd.json");
    expect(result.storyCount).toBe(3);
    expect(result.diagnostics).toEqual([]);
    expect(Object.keys(generated).sort()).toEqual(["branchName", "description", "name", "userStories"].sort());
    expect(generated).toMatchObject({
      name: "Conversion PRD",
      branchName: "ralph/conversion",
      description: "Convert markdown PRD state into ralph JSON. Inline marker text like `[PRD]...[/PRD]` is documentation content, not a block boundary.",
    });
    expect(generated.userStories).toHaveLength(3);
    expect(generated.userStories[0]).toMatchObject({
      id: "US-001",
      priority: 1,
      passes: false,
      notes: "",
      dependsOn: [],
    });
    expect(generated.userStories[1]).toMatchObject({
      id: "US-002",
      priority: 2,
      passes: false,
      notes: "",
      dependsOn: ["US-001"],
    });
    expect(generated.userStories[2]).toMatchObject({
      id: "US-003",
      priority: 3,
      passes: false,
      notes: "",
      dependsOn: ["US-001"],
    });
    for (const story of generated.userStories) {
      expect(story).not.toHaveProperty("status");
      expect(story.acceptanceCriteria).toEqual(
        expect.arrayContaining([
          "`pnpm --filter @qa-sdk/cli test -- docs` passes.",
          "`pnpm --filter @qa-sdk/cli typecheck` passes.",
        ]),
      );
    }

    vi.mocked(console.log).mockClear();
    await cliDocs(["collect", "tasks/conversion-prd.json", "--root", workspace, "--json"]);
    const collected = parsedOutput<{
      familyMembers: Array<{ kind: string; stableId: string }>;
      diagnostics: Array<{ code: string }>;
    }>();
    expect(collected.familyMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "prd", stableId: "tasks/conversion-prd" }),
        expect.objectContaining({ kind: "ralph-prd-json", stableId: "tasks/conversion-prd" }),
      ]),
    );
    expect(collected.diagnostics.map((diagnostic) => diagnostic.code)).not.toEqual(
      expect.arrayContaining([
        "ralph-prd-json-root-prd",
        "ralph-prd-json-root-tasks",
        "ralph-prd-json-story-status",
        "ralph-prd-json-story-depends-on-missing",
      ]),
    );
  });

  it("previews PRD completion sync candidates without mutating docs", async () => {
    const workspace = await createFixtureWorkspace();
    const specPath = join(workspace, "docs/specs/checkout/checkout.spec.md");
    const todoPath = join(workspace, "docs/specs/checkout/checkout.todo.md");
    const planPath = join(workspace, "docs/specs/checkout/checkout.plan.md");
    const prdPath = join(workspace, "tasks/checkout-prd.json");
    const beforeSpec = await readFile(specPath, "utf8");
    const beforeTodo = await readFile(todoPath, "utf8");
    const beforePlan = await readFile(planPath, "utf8");
    const beforePrd = await readFile(prdPath, "utf8");

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--dry-run",
      "--json",
    ]);

    const result = parsedOutput<{
      mode: string;
      dryRunDefaulted: boolean;
      prd: { path: string; storyCount: number; completedStoryCount: number; allStoriesPassing: boolean };
      counts: {
        completedStories: number;
        affectedDocs: number;
        openTodoCandidates: number;
        specUpdateCandidates: number;
        roadmapUpdateCandidates: number;
        scenarioMatrixUpdateCandidates: number;
        sessionDrift: number;
      };
      completedStories: Array<{ id: string; title: string }>;
      affectedDocs: Array<{ kind: string; stableId: string; path: string }>;
      openTodoCandidates: Array<{ promotionState: string; text: string; evidence: unknown[] }>;
      specUpdateCandidates: Array<{ documentId: string; promotionState: string; evidence: unknown[] }>;
      roadmapUpdateCandidates: Array<{ documentId: string; path: string }>;
      scenarioMatrixUpdateCandidates: Array<{ path: string; evidenceIds: string[] }>;
      sessionDrift: Array<{ code: string }>;
    }>();

    expect(result.mode).toBe("dry-run");
    expect(result.dryRunDefaulted).toBe(false);
    expect(result.prd).toMatchObject({
      path: "tasks/checkout-prd.json",
      storyCount: 1,
      completedStoryCount: 1,
      allStoriesPassing: true,
    });
    expect(result.counts).toMatchObject({
      completedStories: 1,
      openTodoCandidates: 2,
      specUpdateCandidates: expect.any(Number),
      roadmapUpdateCandidates: expect.any(Number),
      scenarioMatrixUpdateCandidates: expect.any(Number),
      sessionDrift: 1,
    });
    expect(result.counts.affectedDocs).toBeGreaterThanOrEqual(6);
    expect(result.completedStories).toEqual([
      expect.objectContaining({ id: "US-001", title: "Complete checkout docs" }),
    ]);
    expect(result.affectedDocs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "spec", stableId: "checkout-spec" }),
        expect.objectContaining({ kind: "todo", stableId: "checkout-todo" }),
        expect.objectContaining({ kind: "plan", stableId: "checkout-plan" }),
        expect.objectContaining({ kind: "ralph-session", path: ".ralph-tui/session-meta.json" }),
      ]),
    );
    expect(result.openTodoCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promotionState: "eligible",
          text: "Sync PRD completion ledger.",
          evidence: expect.arrayContaining([
            expect.objectContaining({ kind: "source", path: "packages/checkout/src/index.ts" }),
          ]),
        }),
      ]),
    );
    expect(result.specUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "checkout-spec",
          promotionState: "eligible",
          evidence: expect.arrayContaining([
            expect.objectContaining({ kind: "source", path: "packages/checkout/src/index.ts" }),
          ]),
        }),
      ]),
    );
    expect(result.roadmapUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: "checkout-plan", path: "docs/specs/checkout/checkout.plan.md" }),
      ]),
    );
    expect(result.scenarioMatrixUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "docs/specs/checkout/checkout-scenario-matrix.spec.md",
          evidenceIds: ["E-CHECKOUT-DRIFT"],
        }),
      ]),
    );
    expect(result.sessionDrift).toEqual([
      expect.objectContaining({ code: "ralph-session-prd-complete-session-running" }),
    ]);
    await expect(readFile(specPath, "utf8")).resolves.toBe(beforeSpec);
    await expect(readFile(todoPath, "utf8")).resolves.toBe(beforeTodo);
    await expect(readFile(planPath, "utf8")).resolves.toBe(beforePlan);
    await expect(readFile(prdPath, "utf8")).resolves.toBe(beforePrd);
  });

  it("blocks completion sync promotion when PRD passes lacks source, test, or evidence links", async () => {
    const workspace = await createBlockedCompletionWorkspace();
    const specPath = join(workspace, "docs/specs/inventory/inventory.spec.md");
    const todoPath = join(workspace, "docs/specs/inventory/inventory.todo.md");
    const beforeSpec = await readFile(specPath, "utf8");
    const beforeTodo = await readFile(todoPath, "utf8");

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/inventory-prd.json",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<{
      dryRunDefaulted: boolean;
      counts: { blockedPromotions: number; sessionDrift: number };
      openTodoCandidates: Array<{ promotionState: string; reason: string; evidence: unknown[] }>;
      specUpdateCandidates: Array<{ documentId: string; promotionState: string; reason: string; evidence: unknown[] }>;
      roadmapUpdateCandidates: unknown[];
      scenarioMatrixUpdateCandidates: unknown[];
    }>();
    expect(result.dryRunDefaulted).toBe(true);
    expect(result.counts.blockedPromotions).toBeGreaterThanOrEqual(2);
    expect(result.counts.sessionDrift).toBe(0);
    expect(result.openTodoCandidates).toEqual([
      expect.objectContaining({
        promotionState: "blocked",
        reason: expect.stringContaining("passes=true is not enough"),
        evidence: [],
      }),
    ]);
    expect(result.specUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "inventory-spec",
          promotionState: "blocked",
          reason: expect.stringContaining("source/test/evidence links"),
          evidence: [],
        }),
      ]),
    );
    expect(result.roadmapUpdateCandidates).toHaveLength(1);
    expect(result.scenarioMatrixUpdateCandidates).toHaveLength(1);
    await expect(readFile(specPath, "utf8")).resolves.toBe(beforeSpec);
    await expect(readFile(todoPath, "utf8")).resolves.toBe(beforeTodo);
    expect(process.exitCode).toBeUndefined();
  });

  it("refuses PRD completion sync apply mode", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--apply",
      "--json",
    ]);

    const result = parsedOutput<{
      error: { code: string; operation: string; remediation: string };
    }>();
    expect(result.error).toMatchObject({
      code: "unsupported-operation",
      operation: "docs.prd.sync-completion.apply",
    });
    expect(result.error.remediation).toContain("--dry-run");
    expect(process.exitCode).toBe(1);
  });

  it("refuses PRD scaffold JSON output files", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "prd",
      "scaffold",
      "checkout",
      "--root",
      workspace,
      "--output",
      "tasks/generated-checkout-prd.json",
      "--json",
    ]);

    const result = parsedOutput<{
      error: { code: string; operation: string; remediation: string };
    }>();
    expect(result.error).toMatchObject({
      code: "unsupported-output-format",
      operation: "docs.prd.scaffold",
    });
    expect(result.error.remediation).toContain("explicit adapter command");
    await expect(readFile(join(workspace, "tasks/generated-checkout-prd.json"), "utf8")).rejects.toThrow();
    expect(process.exitCode).toBe(1);
  });

  it("previews metadata transform change sets without writing files by default", async () => {
    const workspace = await createFixtureWorkspace();
    const docPath = join(workspace, "docs/specs/checkout/checkout.spec.md");
    const beforeContent = await readFile(docPath, "utf8");
    const rule = {
      select: { defIds: ["checkout-spec"] },
      set: {
        lifecycle: "review",
        level: "module",
        svc: "checkout-service",
      },
      tags: {
        add: ["reviewed"],
        remove: ["docs"],
      },
      links: {
        add: [{ target: "checkout-todo", type: "contains" }],
        remove: [{ target: "checkout-plan", type: "depends_on" }],
      },
      sources: {
        add: ["packages/checkout/src/service.ts:CheckoutService"],
        remove: ["packages/checkout/src/index.ts:Checkout"],
      },
    };

    await cliDocs([
      "transform",
      "metadata",
      "--root",
      workspace,
      "--rule",
      JSON.stringify(rule),
      "--json",
    ]);

    const result = parsedOutput<{
      mode: string;
      dryRunDefaulted: boolean;
      counts: { matched: number; affected: number; changes: number };
      changeSets: Array<{
        path: string;
        before: {
          lifecycle: string;
          level: string;
          tags: string[];
          links: Array<{ target: string; type: string }>;
          sources: string[];
        };
        after: {
          lifecycle: string;
          level: string;
          svc: string;
          tags: string[];
          links: Array<{ target: string; type: string }>;
          sources: string[];
        };
        changes: Array<{ description: string; metadata: { field: string } }>;
      }>;
    }>();

    expect(result.mode).toBe("dry-run");
    expect(result.dryRunDefaulted).toBe(true);
    expect(result.counts).toMatchObject({ matched: 1, affected: 1 });
    expect(result.counts.changes).toBeGreaterThanOrEqual(6);
    expect(result.changeSets).toHaveLength(1);
    expect(result.changeSets[0]).toMatchObject({
      path: "docs/specs/checkout/checkout.spec.md",
      before: {
        lifecycle: "approved",
        level: "leaf",
      },
      after: {
        lifecycle: "review",
        level: "module",
        svc: "checkout-service",
      },
    });
    expect(result.changeSets[0]!.after.tags).toEqual(["checkout", "reviewed"]);
    expect(result.changeSets[0]!.after.links).toEqual([
      { target: "checkout-todo", type: "contains" },
    ]);
    expect(result.changeSets[0]!.after.sources).toEqual([
      "packages/checkout/src/service.ts:CheckoutService",
    ]);
    expect(result.changeSets[0]!.changes.map((change) => change.metadata.field)).toEqual(
      expect.arrayContaining(["lifecycle", "level", "tags", "links", "svc", "sources"]),
    );
    await expect(readFile(docPath, "utf8")).resolves.toBe(beforeContent);
  });

  it("prints text metadata transform previews with explicit dry-run", async () => {
    const workspace = await createFixtureWorkspace();
    const rule = {
      select: { paths: ["docs/specs/checkout/checkout.todo.md"] },
      set: { lifecycle: "review" },
    };

    await cliDocs([
      "transform",
      "metadata",
      "--root",
      workspace,
      "--rule",
      JSON.stringify(rule),
      "--dry-run",
    ]);

    const text = output();
    expect(text).toContain("docs transform metadata: dry-run");
    expect(text).toContain("dry-run defaulted: no");
    expect(text).toContain("docs/specs/checkout/checkout.todo.md");
    expect(text).toContain("lifecycle");
  });

  it("returns a structured unsupported-operation error for metadata --apply", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "transform",
      "metadata",
      "--root",
      workspace,
      "--rule",
      "{}",
      "--apply",
    ]);

    const result = parsedError<{
      error: { code: string; operation: string; remediation: string };
    }>();
    expect(result.error).toMatchObject({
      code: "unsupported-operation",
      operation: "docs.transform.metadata.apply",
    });
    expect(result.error.remediation).toContain("later apply PRD");
    expect(process.exitCode).toBe(1);
  });

  it("refuses metadata transforms against PRD JSON adapters", async () => {
    const workspace = await createFixtureWorkspace();
    const prdJsonPath = join(workspace, "tasks/checkout-prd.json");
    const beforeContent = await readFile(prdJsonPath, "utf8");

    await cliDocs([
      "transform",
      "metadata",
      "--root",
      workspace,
      "--rule",
      JSON.stringify({
        select: { paths: ["tasks/checkout-prd.json"] },
        set: { lifecycle: "approved" },
      }),
      "--json",
    ]);

    const result = parsedOutput<{
      counts: { matched: number; affected: number };
      diagnostics: Array<{ code: string; severity: string; rawSource?: { path: string } }>;
    }>();
    expect(result.counts).toMatchObject({ matched: 1, affected: 0 });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "metadata-transform-unsupported-source",
          severity: "error",
          rawSource: expect.objectContaining({ path: "tasks/checkout-prd.json" }),
        }),
      ]),
    );
    await expect(readFile(prdJsonPath, "utf8")).resolves.toBe(beforeContent);
    expect(process.exitCode).toBe(1);
  });

  it("refuses metadata transform rules that touch def.id", async () => {
    const workspace = await createFixtureWorkspace();
    const docPath = join(workspace, "docs/specs/checkout/checkout.spec.md");
    const beforeContent = await readFile(docPath, "utf8");

    await cliDocs([
      "transform",
      "metadata",
      "--root",
      workspace,
      "--rule",
      JSON.stringify({
        select: { defIds: ["checkout-spec"] },
        set: { id: null },
      }),
      "--json",
    ]);

    const result = parsedOutput<{
      counts: { matched: number; affected: number };
      diagnostics: Array<{ code: string; message: string }>;
    }>();
    expect(result.counts).toMatchObject({ matched: 0, affected: 0 });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "metadata-transform-protected-field",
          message: expect.stringContaining("def.id"),
        }),
      ]),
    );
    await expect(readFile(docPath, "utf8")).resolves.toBe(beforeContent);
    expect(process.exitCode).toBe(1);
  });
});
