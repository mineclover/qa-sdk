// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { main, resolveSubcommand, USAGE } from "../index.js";
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
    - target: checkout-child
      type: contains
    - target: checkout-refinement
      type: refines
    - target: US-001
      type: traces_to
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
  links:
    - target: US-001
      type: traces_to
---
# Checkout Todo

## 목적 ^purpose

Follow up on checkout implementation evidence.

## Actionable — 실행 가능

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
  links:
    - target: US-001
      type: traces_to
---
# Checkout Plan

## 목적 ^purpose

Plan checkout adapter follow-up work.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout-child.spec.md"), `---
def:
  id: checkout-child
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Checkout Child Spec

## 목적 ^purpose

Defines the contained checkout child behavior.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout-refinement.spec.md"), `---
def:
  id: checkout-refinement
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Checkout Refinement Spec

## 목적 ^purpose

Refines the checkout specification.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout.rule.md"), `---
def:
  id: checkout-rule
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
---
# Checkout Rule

## 목적 ^purpose

Constrain checkout implementation changes.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout.test.md"), `---
def:
  id: checkout-test
  level: leaf
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: approved
---
# Checkout Test

## 목적 ^purpose

Validate checkout behavior.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout.memo.md"), `---
def:
  id: checkout-memo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
---
# Checkout Memo

## 목적 ^purpose

Record checkout implementation notes.
`);

    await writeFile(join(rootDir, "docs/specs/checkout/checkout-knowledge.spec.md"), `---
def:
  id: checkout-knowledge
  type: knowledge
  knowledge_kind: guide
  level: leaf
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  links:
    - target: checkout-spec
      type: depends_on
familyId: docs/specs/checkout/checkout
---
# Checkout Knowledge

## 목적 ^purpose

Explain why checkout docs stay grouped.
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
  links:
    - target: US-001
      type: traces_to
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

  async function writePrdPair(
    workspace: string,
    relativeBase: string,
    title: string,
  ): Promise<void> {
    const markdownPath = join(workspace, "tasks", `${relativeBase}.md`);
    const jsonPath = join(workspace, "tasks", `${relativeBase}.json`);
    await mkdir(dirname(markdownPath), { recursive: true });
    await writeFile(markdownPath, `[PRD]
# PRD: ${title}

## Overview

Track completed PRD lifecycle state.

## User Stories

### US-001: Complete lifecycle state

**Description:** As a docs operator, I want completed lifecycle state.

**Acceptance Criteria:**
- [x] Completed lifecycle state is recorded.
[/PRD]
`);
    await writeFile(jsonPath, JSON.stringify({
      name: title,
      branchName: `ralph/${relativeBase.replaceAll("/", "-")}`,
      description: "Track completed PRD lifecycle state.",
      userStories: [
        {
          id: "US-001",
          title: "Complete lifecycle state",
          description: "As a docs operator, I want completed lifecycle state.",
          acceptanceCriteria: [
            "Completed lifecycle state is recorded.",
          ],
          priority: 1,
          passes: true,
          dependsOn: [],
          notes: "Completed by agent.",
          completionNotes: "Completed by agent.",
        },
      ],
    }, null, 2));
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
  links:
    - target: US-001
      type: traces_to
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
  links:
    - target: US-001
      type: traces_to
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
  links:
    - target: US-001
      type: traces_to
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
  links:
    - target: US-001
      type: traces_to
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

  async function addSourceOnlyCompletionCandidate(workspace: string): Promise<void> {
    await writeFile(join(workspace, "docs/specs/checkout/checkout-source-only.spec.md"), `---
def:
  id: checkout-source-only
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: approved
source: packages/checkout/src/completion.ts
---
# Checkout Source Only

## 목적 ^purpose

Provide source-only completion proof for PRD sync precision tests.
`);
    const prdPath = join(workspace, "tasks/checkout-prd.json");
    const prdJson = JSON.parse(await readFile(prdPath, "utf8")) as {
      userStories: Array<{ completionNotes?: string }>;
    };
    prdJson.userStories[0]!.completionNotes = "Completed by agent. See packages/checkout/src/completion.ts.";
    await writeFile(prdPath, JSON.stringify(prdJson, null, 2));
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

  interface GraphRankFactor {
    readonly factor: string;
    readonly score: number;
    readonly reason: string;
    readonly metadata: Record<string, unknown>;
  }

  interface GraphRankedNode {
    readonly nodeId: string;
    readonly rank: number;
    readonly score: number;
    readonly strength: string;
    readonly factors: readonly GraphRankFactor[];
    readonly reasonSummary: readonly string[];
  }

  interface GraphSummary {
    readonly algorithm: string;
    readonly scope: string;
    readonly nodes: number;
    readonly edges: number;
    readonly paths: number;
    readonly diagnostics: number;
    readonly diagnosticCounts: {
      readonly traversal: number;
      readonly node: number;
      readonly bySeverity: Record<string, number>;
    };
    readonly archive: {
      readonly included: number;
      readonly excluded: number;
    };
    readonly counts: {
      readonly byNodeKind: Record<string, number>;
      readonly byTraversalAxis: Record<string, number>;
      readonly byDocumentRole: Record<string, number>;
      readonly bySemanticType: Record<string, number>;
      readonly byFollowUpCategory: Record<string, number>;
    };
  }

  interface GraphOutput {
    readonly input: {
      readonly target: string;
      readonly axes: string[];
      readonly direction: string;
      readonly depth: number;
      readonly limit: number;
      readonly preset?: string;
    };
    readonly targetResolution: {
      readonly lookupKind: string;
      readonly indexed: boolean;
    };
    readonly counts: {
      readonly nodes: number;
      readonly edges: number;
      readonly paths: number;
      readonly diagnostics: number;
    };
    readonly ranking: {
      readonly algorithm: string;
      readonly rankedNodes: readonly GraphRankedNode[];
      readonly counts: Record<string, number>;
    };
    readonly summary: GraphSummary;
    readonly filters: {
      readonly kinds: readonly string[];
      readonly roles: readonly string[];
      readonly axes: readonly string[];
      readonly followUpCategories: readonly string[];
      readonly includeArchive: boolean;
    };
    readonly filtering: {
      readonly algorithm: string;
      readonly filters: GraphOutput["filters"];
      readonly filteredNodeIds: readonly string[];
      readonly filteredNodes: readonly GraphRankedNode[];
      readonly counts: {
        readonly rawRankedNodes: number;
        readonly filteredNodes: number;
        readonly excludedByArchive: number;
        readonly excludedByFilters: number;
      };
    };
    readonly rankedNodes: readonly GraphRankedNode[];
    readonly filteredNodes: readonly GraphRankedNode[];
    readonly nodes: Array<{ id: string; kind: string; path?: string }>;
    readonly edges: Array<{
      axis: string;
      authoredType?: string;
      fromNodeId: string;
      toNodeId: string;
      reasons: Array<{ reason: string }>;
    }>;
    readonly paths: unknown[];
    readonly roleGroups: Array<{ roleType: string }>;
    readonly truncated: boolean;
    readonly omittedCount: number;
    readonly omittedCounts: {
      readonly nodes: number;
      readonly edges: number;
      readonly depth: number;
    };
    readonly diagnostics: string[];
  }

  it("prints text status and identifies todo follow-up state", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["status", "checkout-spec", "--root", workspace]);

    const text = output();
    expect(text).toContain("docs status: checkout-spec");
    expect(text).toContain("kind: spec");
    expect(text).toContain("next follow-up: open todo - Remove obsolete checkout stub.");
    expect(text).toContain("category: Actionable — 실행 가능");
    expect(text).toContain("docs/specs/checkout/checkout.todo.md");
  });

  it("reports responsibility closure state for document and source targets", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "packages/checkout/src"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/checkout/checkout-symbol.spec.md"), `---
def:
  id: checkout-symbol
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
source: packages/checkout/src/index.ts:createCheckout
---
# Checkout Symbol

## 목적 ^purpose

Map checkout symbol-level implementation ownership.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout-comment-boundary.spec.md"), `---
def:
  id: checkout-comment-boundary
  tier: system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
---
# Checkout Comment Boundary

## 목적 ^purpose

Map checkout code comments into docs closure source targets.
`);
    await writeFile(join(workspace, "packages/checkout/src/comment-mapped.ts"), `// @def${".boundary"} checkout-comment-boundary
// @def${".doc"} checkout-comment-boundary#createCheckoutComment

export function createCheckoutComment() {
  return true;
}
`);

    await writeFile(join(workspace, "docs/specs/checkout/checkout-permission-error-observability.spec.md"), `---
def:
  id: checkout-permission-error-observability
  tier: system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [security, observability, error-handling]
source: packages/checkout/src/permission-error-observability.ts
---
# Checkout Permission Error Observability

## 목적 ^purpose

Coordinates checkout permission, error, and observability responsibility without evidence.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout-external-evidence.spec.md"), `---
def:
  id: checkout-external-evidence
  tier: system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
source: packages/checkout/src/external-evidence.ts
---
# Checkout External Evidence

## 목적 ^purpose

Own external source evidence that must not satisfy a dependent document closure.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout-dependent-no-source.spec.md"), `---
def:
  id: checkout-dependent-no-source
  tier: system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  links:
    - target: checkout-external-evidence
      type: depends_on
---
# Checkout Dependent No Source

## 목적 ^purpose

Depend on another document that has source evidence, while this responsibility has no own source mapping.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout-layout-no-source.spec.md"), `---
def:
  id: checkout-layout-no-source
  tier: layout
  scope: ui
  aspect: layout
  depth: overview
  lifecycle: approved
  links:
    - target: checkout-comment-boundary
      type: refs
---
# Checkout Layout No Source

## 목적 ^purpose

Organize checkout systems without owning implementation source.
`);

    await cliDocs(["closure", "checkout-spec", "--root", workspace, "--json"]);

    const docClosure = parsedOutput<{
      state: string;
      responsibility: string;
      document: { stableId: string };
      boundary: { stableId: string };
      consumedRules: Array<{ stableId: string }>;
      evidence: {
        sources: unknown[];
        tests: Array<{ stableId: string }>;
      };
      missing: Array<{ code: string; severity: string }>;
    }>();

    expect(docClosure).toMatchObject({
      state: "drifted",
      responsibility: "System",
      document: { stableId: "checkout-spec" },
      boundary: { stableId: "checkout-spec" },
    });
    expect(docClosure.consumedRules.map((rule) => rule.stableId)).toContain("checkout-rule");
    expect(docClosure.evidence.sources.length).toBeGreaterThan(0);
    expect(docClosure.evidence.tests.map((test) => test.stableId)).toContain("checkout-test");
    expect(docClosure.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "lifecycle-follow-up", severity: "warning" }),
      ]),
    );
    expect(docClosure.missing.map((item) => item.code)).toContain("diagnostic-error");

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "checkout-rule", "--root", workspace, "--json"]);

    const ruleClosure = parsedOutput<{
      state: string;
      document: { stableId: string; kind: string };
      evidence: { sources: unknown[] };
      missing: Array<{ code: string; severity: string }>;
    }>();
    expect(ruleClosure.document).toMatchObject({ stableId: "checkout-rule", kind: "rule" });
    expect(ruleClosure.state).not.toBe("mapped");
    expect(ruleClosure.missing.map((item) => item.code)).not.toContain("source-mapping");

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "packages/checkout/src/index.ts", "--root", workspace, "--json"]);

    const sourceClosure = parsedOutput<{
      state: string;
      sourceTarget: {
        path: string;
        matches: Array<{ document: { stableId: string } }>;
      };
    }>();
    expect(sourceClosure.state).toBe("drifted");
    expect(sourceClosure.sourceTarget.path).toBe("packages/checkout/src/index.ts");
    expect(sourceClosure.sourceTarget.matches.map((match) => match.document.stableId)).toEqual(
      expect.arrayContaining(["checkout-spec", "checkout-symbol"]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "packages/checkout/src/index.ts:createCheckout", "--root", workspace, "--json"]);

    const symbolClosure = parsedOutput<{
      sourceTarget: {
        path: string;
        matches: Array<{
          document: { stableId: string };
          source: { label?: string; metadata: { symbol?: string } };
        }>;
      };
    }>();
    expect(symbolClosure.sourceTarget.path).toBe("packages/checkout/src/index.ts:createCheckout");
    expect(symbolClosure.sourceTarget.matches).toEqual([
      expect.objectContaining({
        document: expect.objectContaining({ stableId: "checkout-symbol" }),
        source: expect.objectContaining({
          label: "createCheckout",
          metadata: expect.objectContaining({ symbol: "createCheckout" }),
        }),
      }),
    ]);

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "packages/checkout/src/comment-mapped.ts:createCheckoutComment", "--root", workspace, "--json"]);

    const commentClosure = parsedOutput<{
      state: string;
      sourceTarget: {
        path: string;
        matches: Array<{
          document: { stableId: string };
          source: { metadata: { sourceKind?: string; relationType?: string; symbol?: string } };
        }>;
      };
    }>();
    expect(commentClosure.state).not.toBe("unmapped");
    expect(commentClosure.sourceTarget.path).toBe("packages/checkout/src/comment-mapped.ts:createCheckoutComment");
    expect(commentClosure.sourceTarget.matches).toEqual([
      expect.objectContaining({
        document: expect.objectContaining({ stableId: "checkout-comment-boundary" }),
        source: expect.objectContaining({
          metadata: expect.objectContaining({
            sourceKind: "code_comment",
            relationType: "doc",
            symbol: "createCheckoutComment",
          }),
        }),
      }),
    ]);

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "checkout-spec", "--root", workspace]);

    const text = output();
    expect(text).toContain("docs closure: checkout-spec");
    expect(text).toContain("state: drifted");
    expect(text).toContain("consumed rules: checkout-rule");

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "checkout-permission-error-observability", "--root", workspace, "--json"]);

    const concernClosure = parsedOutput<{
      state: string;
      missing: Array<{ code: string; severity: string }>;
    }>();
    const concernMissingCodes = concernClosure.missing.map((item) => item.code);
    expect(concernClosure.state).toBe("mapped");
    expect(concernMissingCodes).toContain("error-policy-evidence");
    expect(concernMissingCodes).toContain("permission-policy-evidence");
    expect(concernMissingCodes).toContain("observability-evidence");

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "checkout-dependent-no-source", "--root", workspace, "--json"]);

    const dependencyLeakClosure = parsedOutput<{
      state: string;
      evidence: { sources: unknown[] };
      missing: Array<{ code: string; severity: string }>;
    }>();
    expect(dependencyLeakClosure.state).toBe("mapped");
    expect(dependencyLeakClosure.evidence.sources).toHaveLength(0);
    expect(dependencyLeakClosure.missing.map((item) => item.code)).toContain("source-mapping");

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "checkout-layout-no-source", "--root", workspace, "--json"]);

    const layoutNoSourceClosure = parsedOutput<{
      state: string;
      responsibility: string;
      evidence: { sources: unknown[] };
      missing: Array<{ code: string; severity: string }>;
    }>();
    expect(layoutNoSourceClosure.responsibility).toBe("Layout / Pack");
    expect(layoutNoSourceClosure.state).toBe("closed");
    expect(layoutNoSourceClosure.missing.map((item) => item.code)).not.toContain("source-mapping");

    await writeFile(join(workspace, "docs/specs/checkout/checkout-authoring-catalog.spec.md"), `---
def:
  id: checkout-authoring-catalog
  tier: system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  links:
    - target: checkout-rule
      type: traces_to
source: packages/checkout/src/authoring-catalog.ts
---
# Checkout Authoring Catalog

## 목적 ^purpose

Describe authoring catalog behavior without access-control or telemetry concerns.
`);

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "checkout-authoring-catalog", "--root", workspace, "--json"]);

    const keywordBoundaryClosure = parsedOutput<{
      missing: Array<{ code: string; severity: string }>;
    }>();
    const keywordBoundaryMissingCodes = keywordBoundaryClosure.missing.map((item) => item.code);
    expect(keywordBoundaryMissingCodes).not.toContain("permission-policy-evidence");
    expect(keywordBoundaryMissingCodes).not.toContain("observability-evidence");

    await writeFile(join(workspace, "docs/specs/checkout/checkout-permission-error-observability.rule.md"), `---
def:
  id: checkout-permission-error-observability-rule
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  links:
    - target: checkout-permission-error-observability
      type: constrains
---
# Checkout Permission Error Observability Rule

## 목적 ^purpose

Define checkout permission policy, error envelope, and observability evidence requirements.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout-permission-error-observability.test.md"), `---
def:
  id: checkout-permission-error-observability-test
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  links:
    - target: checkout-permission-error-observability
      type: verifies
source: packages/checkout/src/permission-error-observability.test.ts
---
# Checkout Permission Error Observability Test

## 목적 ^purpose

Verify permission denial, error envelope, and audit event observability behavior.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout-permission-error-observability.cases.md"), `---
def:
  id: checkout-permission-error-observability-cases
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  links:
    - target: checkout-permission-error-observability
      type: refines
---
# Checkout Permission Error Observability Cases

## 목적 ^purpose

Specify consumer expectations for permission policy, error response, and observability event evidence.

## 시나리오 1: denied checkout emits audit event ^overview

**전제**: actor lacks checkout permission.

**동작**: checkout submit is requested.

**기대**:
- permission denied error is returned.
- audit event is emitted.

**실패 시 수정 대상**: checkout-permission-error-observability-rule
`);

    vi.mocked(console.log).mockClear();
    await cliDocs(["closure", "checkout-permission-error-observability", "--root", workspace, "--json"]);

    const positiveConcernClosure = parsedOutput<{
      state: string;
      consumedRules: Array<{ stableId: string }>;
      evidence: {
        tests: Array<{ stableId: string }>;
        cases: Array<{ stableId: string }>;
      };
      missing: Array<{ code: string; severity: string }>;
    }>();
    const positiveMissingCodes = positiveConcernClosure.missing.map((item) => item.code);
    expect(positiveConcernClosure.state).toBe("closed");
    expect(positiveConcernClosure.consumedRules.map((rule) => rule.stableId)).toContain("checkout-permission-error-observability-rule");
    expect(positiveConcernClosure.evidence.tests.map((test) => test.stableId)).toContain("checkout-permission-error-observability-test");
    expect(positiveConcernClosure.evidence.cases.map((cases) => cases.stableId)).toContain("checkout-permission-error-observability-cases");
    expect(positiveMissingCodes).not.toContain("error-policy-evidence");
    expect(positiveMissingCodes).not.toContain("permission-policy-evidence");
    expect(positiveMissingCodes).not.toContain("observability-evidence");
  });

  it("preserves todo hierarchy in JSON status follow-up candidates", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/hierarchy"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/hierarchy/hierarchy.todo.md"), `---
def:
  id: hierarchy-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Hierarchy Todo

## 목적 ^purpose

Track parent and child follow-up context.

## Actionable — 실행 가능

- [ ] Parent work item.
  - [ ] Child checklist item 1.
  - [ ] Child checklist item 2.
  - [ ] Child checklist item 3.
  - [ ] Child checklist item 4.
  - [ ] Child checklist item 5.
  - [ ] Child checklist item 6.
  - [ ] Child checklist item 7.
`);

    await cliDocs(["status", "hierarchy-todo", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      nextFollowUps: Array<{
        title: string;
        pointer?: string;
        depth?: number;
        parentTitle?: string;
        headingPath?: string[];
        category?: string;
        categoryLabel?: string;
      }>;
    }>();
    const parent = result.nextFollowUps.find((followUp) => followUp.title === "Parent work item.");
    const child = result.nextFollowUps.find((followUp) => followUp.title === "Child checklist item 1.");

    expect(parent).toMatchObject({
      pointer: expect.stringMatching(/^line \d+$/),
      depth: 0,
      headingPath: ["Actionable — 실행 가능"],
      category: "actionable",
      categoryLabel: "Actionable — 실행 가능",
    });
    expect(parent).not.toHaveProperty("parentTitle");
    expect(child).toMatchObject({
      pointer: expect.stringMatching(/^line \d+$/),
      depth: 1,
      parentTitle: "Parent work item.",
      headingPath: ["Actionable — 실행 가능"],
      category: "actionable",
      categoryLabel: "Actionable — 실행 가능",
    });
    expect(parent?.pointer).not.toBe(child?.pointer);
    expect(parent?.depth).not.toBe(child?.depth);

    vi.mocked(console.log).mockClear();
    await cliDocs(["status", "hierarchy-todo", "--root", workspace]);

    const text = output();
    expect(text).toContain("next follow-up: open todo - Parent work item.");
    expect(text).toContain("additional follow-ups (7):");
    expect(text).toContain("... 2 more");
    expect(text).not.toContain("Child checklist item 7.");
  });

  it("inherits canonical todo categories through nested headings", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/categories"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/categories/categories.todo.md"), `---
def:
  id: categories-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Category Todo

## 목적 ^purpose

Track categorized follow-up state.

## 구현 항목

### Completed — 완료 기록

#### Closed Group

- [x] Completed item.

### Actionable — 실행 가능

#### Policy Source Adapter

- [ ] Implement adapter.

### Deferred — 조건부 대기

#### Remote Activation

- [ ] Wait for API contract.

### Parking Lot — 후보 보관

#### Candidate Ideas

- [ ] Evaluate optional dashboard.
`);

    await cliDocs(["status", "categories-todo", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      nextFollowUps: Array<{
        title: string;
        category?: string;
        categoryLabel?: string;
        headingPath?: string[];
      }>;
    }>();

    expect(result.nextFollowUps.map((followUp) => followUp.title)).toEqual([
      "Implement adapter.",
      "Wait for API contract.",
      "Evaluate optional dashboard.",
    ]);
    expect(result.nextFollowUps).toEqual([
      expect.objectContaining({
        title: "Implement adapter.",
        category: "actionable",
        categoryLabel: "Actionable — 실행 가능",
        headingPath: ["구현 항목", "Actionable — 실행 가능", "Policy Source Adapter"],
      }),
      expect.objectContaining({
        title: "Wait for API contract.",
        category: "deferred",
        categoryLabel: "Deferred — 조건부 대기",
        headingPath: ["구현 항목", "Deferred — 조건부 대기", "Remote Activation"],
      }),
      expect.objectContaining({
        title: "Evaluate optional dashboard.",
        category: "parking-lot",
        categoryLabel: "Parking Lot — 후보 보관",
        headingPath: ["구현 항목", "Parking Lot — 후보 보관", "Candidate Ideas"],
      }),
    ]);
  });

  it("reports completed TODO records separately from follow-up candidates", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/event-vocab-system"), { recursive: true });
    await mkdir(join(workspace, "docs/specs/rlsc"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/event-vocab-system/event-taxonomy-rollout.todo.md"), `---
def:
  id: event-taxonomy-rollout-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
---
# Event Taxonomy Rollout

## 목적 ^purpose

Track completed event taxonomy rollout work.

## Completed — 완료 기록

- [x] Seed events no longer hardcode service id.
- [x] Event adoption read model exists.
`);
    await writeFile(join(workspace, "docs/specs/rlsc/rlsc-text-occupancy.todo.md"), `---
def:
  id: rlsc-text-occupancy-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
---
# RLSC Text Occupancy

## 목적 ^purpose

Track completed RLSC text occupancy work.

## Completed — 완료 기록

- [x] Text occupancy metrics are implemented.
`);

    await cliDocs(["status", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      completedRecords: Array<{
        state: string;
        kind: string;
        documentId: string;
        path: string;
        completedCount?: number;
        openCount?: number;
        lifecycle?: string;
      }>;
      nextFollowUps: Array<{ documentId: string; path: string; state: string }>;
    }>();

    expect(result.completedRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: "completed-record",
          kind: "todo",
          documentId: "event-taxonomy-rollout-todo",
          path: "docs/specs/event-vocab-system/event-taxonomy-rollout.todo.md",
          completedCount: 2,
          openCount: 0,
          lifecycle: "draft",
        }),
        expect.objectContaining({
          state: "completed-record",
          kind: "todo",
          documentId: "rlsc-text-occupancy-todo",
          path: "docs/specs/rlsc/rlsc-text-occupancy.todo.md",
          completedCount: 1,
          openCount: 0,
          lifecycle: "draft",
        }),
      ]),
    );
    expect(result.nextFollowUps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: "event-taxonomy-rollout-todo" }),
        expect.objectContaining({ documentId: "rlsc-text-occupancy-todo" }),
      ]),
    );
  });

  it("reports completed PRD markdown records without treating markdown checkboxes as follow-ups", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["status", "tasks/checkout-prd", "--root", workspace, "--family-only", "--json"]);

    const result = parsedOutput<{
      nextFollowUp: null | { kind: string; title: string; path: string };
      completedRecords: Array<{
        state: string;
        kind: string;
        documentId: string;
        path: string;
        pairedPath?: string;
        storyCount?: number;
        passedStoryCount?: number;
      }>;
      nextFollowUps: Array<{ kind: string; title: string; path: string }>;
    }>();

    expect(result.completedRecords).toEqual([
      expect.objectContaining({
        state: "completed-record",
        kind: "prd",
        documentId: "tasks/checkout-prd",
        path: "tasks/checkout-prd.md",
        pairedPath: "tasks/checkout-prd.json",
        storyCount: 1,
        passedStoryCount: 1,
      }),
    ]);
    expect(result.nextFollowUp).toBeNull();
    expect(result.nextFollowUps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "prd",
          title: "Complete checkout docs",
          path: "tasks/checkout-prd.md",
        }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs(["status", "tasks/checkout-prd", "--root", workspace, "--family-only"]);

    const text = output();
    expect(text).toContain("next follow-up: none");
    expect(text).toContain("completed records (1):");
    expect(text).toContain("[completed-record] Checkout PRD (tasks/checkout-prd.md paired=tasks/checkout-prd.json)");
    expect(text).not.toContain("additional follow-ups");
  });

  it("includes completed records in family-only collect without promoting them to active work", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["collect", "tasks/checkout-prd", "--root", workspace, "--family-only", "--json"]);

    const result = parsedOutput<{
      nextFollowUp: null | { kind: string; title: string; path: string };
      nextFollowUps: Array<{ kind: string; title: string; path: string }>;
      completedRecords: Array<{
        state: string;
        kind: string;
        documentId: string;
        path: string;
        pairedPath?: string;
      }>;
      familyMembers: Array<{ stableId: string; kind: string; path: string }>;
    }>();

    expect(result.familyMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stableId: "tasks/checkout-prd",
          kind: "prd",
          path: "tasks/checkout-prd.md",
        }),
        expect.objectContaining({
          stableId: "tasks/checkout-prd",
          kind: "ralph-prd-json",
          path: "tasks/checkout-prd.json",
        }),
      ]),
    );
    expect(result.completedRecords).toEqual([
      expect.objectContaining({
        state: "completed-record",
        kind: "prd",
        documentId: "tasks/checkout-prd",
        path: "tasks/checkout-prd.md",
        pairedPath: "tasks/checkout-prd.json",
      }),
    ]);
    expect(result.nextFollowUp).toBeNull();
    expect(result.nextFollowUps).toEqual([]);
  });

  it("exposes docs graph through root usage, dispatch, and command help", async () => {
    expect(USAGE).toContain("qa-sdk docs graph <target>");
    expect(USAGE).toContain("qa-sdk docs closure <doc-id|path|source-file[:symbol]>");
    expect(USAGE).toContain("qa-sdk docs explore <doc-id|path>");
    expect(resolveSubcommand(["docs", "closure", "checkout-spec"])).toEqual({
      name: "docs closure",
      rest: ["checkout-spec"],
    });
    expect(resolveSubcommand(["docs", "graph", "checkout-spec", "--axis", "source,evidence"])).toEqual({
      name: "docs graph",
      rest: ["checkout-spec", "--axis", "source,evidence"],
    });
    expect(resolveSubcommand(["docs", "explore", "checkout-spec"])).toEqual({
      name: "docs explore",
      rest: ["checkout-spec"],
    });

    await main(["docs", "help"]);

    const rootHelp = output();
    expect(rootHelp).toContain("Quick Start");
    expect(rootHelp).toContain("qa-sdk docs explore <doc-id|path>");

    vi.mocked(console.log).mockClear();
    await main(["docs", "graph", "--help"]);

    const graphHelp = output();
    expect(graphHelp).toContain("qa-sdk docs graph");
    expect(graphHelp).toContain("--axis");
    expect(graphHelp).toContain("--preset");
    expect(graphHelp).toContain("--verbose");
  });

  it("prints guided explore output for a document family", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["explore", "checkout-spec", "--root", workspace]);

    const text = output();
    expect(text).toContain("docs explore: checkout-spec");
    expect(text).toContain("mode: intent");
    expect(text).toContain("entry: [spec] checkout-spec");
    expect(text).toContain("intent: Coordinate checkout documentation state.");
    expect(text).toContain("owns: flow/process_flow responsibility");
    expect(text).toContain("family members:");
    expect(text).toContain("use --mode=map");
    expect(text).toContain("next:");
    expect(text).toContain("qa-sdk docs collect checkout-spec --family-only");
    expect(text).not.toContain("artifact roles:");

    vi.mocked(console.log).mockClear();
    await cliDocs(["explore", "checkout-spec", "--root", workspace, "--mode=map"]);

    const mapText = output();
    expect(mapText).toContain("mode: map");
    expect(mapText).toContain("artifact roles:");
    expect(text).toContain("qa-sdk docs graph checkout-spec --preset family");

    vi.mocked(console.log).mockClear();
    await cliDocs(["explore", "checkout-spec", "--root", workspace, "--mode=diagnostic"]);

    const diagnosticText = output();
    expect(diagnosticText).toContain("mode: diagnostic");
    expect(diagnosticText).toContain("links/sources/tasks/evidence/diagnostics:");
  });

  it("routes service and owner selectors to root index documents", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/payments"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/payments/payments-system.spec.md"), `---
def:
  id: payments-system
  type: design
  tier: system
  owner_system: payments-system
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  svc: payments
  tags: [entry-point]
---
# Payments System

## 목적 ^purpose

Own the payments runtime boundary.
`);
    await writeFile(join(workspace, "docs/specs/payments/payments-api.spec.md"), `---
def:
  id: payments-api
  type: design
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: payments
  owner_system: payments-system
---
# Payments API

## 목적 ^purpose

Define the public payments API contract.
`);

    await cliDocs(["explore", "service:payments", "--root", workspace]);
    const serviceText = output();
    expect(serviceText).toContain("docs explore: service:payments");
    expect(serviceText).toContain("entry: [spec] payments-system");
    expect(serviceText).toContain("intent: Own the payments runtime boundary.");

    vi.mocked(console.log).mockClear();
    await cliDocs(["explore", "owner:payments-system", "--root", workspace]);
    const ownerText = output();
    expect(ownerText).toContain("entry: [spec] payments-system");
  });

  it("uses selector-bounded search for service roots", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/payments"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/payments/payments-system.spec.md"), `---
def:
  id: payments-system
  type: design
  tier: system
  owner_system: payments-system
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  svc: payments
  tags: [entry-point]
---
# Payments System

## 목적 ^purpose

Own the payments runtime boundary.
`);
    await writeFile(join(workspace, "docs/specs/payments/payments-api.spec.md"), `---
def:
  id: payments-api
  type: design
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: payments
  owner_system: payments-system
---
# Payments API

## 목적 ^purpose

Define the public payments API contract.
`);

    await cliDocs(["search", "service:payments", "--root", workspace]);
    const text = output();
    expect(text).toContain('docs search: "service:payments"');
    expect(text).toContain("selector: service=payments");
    expect(text).toContain("selector scope: root");
    expect(text).toContain("root index: [spec] payments-system");
    expect(text).toContain("bounded by selector root-index routing");
    expect(text).toContain("[spec] payments-system");
    expect(text).not.toContain("warning: text search is broad");

    vi.mocked(console.log).mockClear();
    await cliDocs(["search", "service:payments", "--root", workspace, "--selector-scope=owned"]);

    const ownedText = output();
    expect(ownedText).toContain("selector scope: owned");
    expect(ownedText).toContain("[spec] payments-system");
    expect(ownedText).toContain("[spec] payments-api");
  });

  it("[contract:docs-control-plane.bdd.cli.list-contracts.v1][contract:docs-control-plane.bdd.cli.validate-contracts.v1][contract:docs-control-plane.bdd.cli.units-grouped.v1] exposes BDD contracts and units through docs bdd commands", async () => {
    const workspace = await createFixtureWorkspace();
    await writeFile(join(workspace, "docs/specs/checkout/checkout.cases.md"), `---
def:
  id: checkout-cases
  level: leaf
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
familyId: docs/specs/checkout/checkout
---
# Checkout Cases

## 목적 ^purpose

Define checkout BDD contracts.

\`\`\`yaml bdd
bdd_contracts:
  - id: checkout.pending.submit.accepted.v1
    owner_system: checkout-system
    contract_kind: state-transition
    mode: write
    given:
      state: PENDING
      predicates: [cart.exists]
    when:
      operation: checkout-system.submit
      event_key: checkout.submit.requested
    then:
      state: ACCEPTED
      emits: [checkout.accepted]
  - id: checkout.pending.submit.permission-denied.v1
    owner_system: checkout-system
    contract_kind: validation-failure
    mode: write
    given:
      state: PENDING
      predicates: ["!actor.can_submit"]
    when:
      operation: checkout-system.submit
    then:
      error:
        code: permission_denied
test_units:
  - id: TU-checkout-submit-accepted
    contract: checkout.pending.submit.accepted.v1
    level: integration
    assertions: [then.state, then.emits]
    test_file: packages/checkout/src/checkout-system.test.ts
  - id: TU-checkout-submit-permission-denied
    contract: checkout.pending.submit.permission-denied.v1
    level: unit
    assertions: [then.error]
implementation_units:
  - id: IU-checkout-submit-operation
    contract: checkout.pending.submit.accepted.v1
    unit_kind: operation
    owned_by: checkout-system
    source_target: packages/checkout/src/checkout-system.ts
  - id: IU-checkout-submit-permission-guard
    contract: checkout.pending.submit.permission-denied.v1
    unit_kind: guard
    owned_by: checkout-system
    source_target: packages/checkout/src/checkout-guards.ts
\`\`\`
`);

    expect(USAGE).toContain("qa-sdk docs bdd list");
    expect(resolveSubcommand(["docs", "bdd", "units", "checkout-spec"])).toEqual({
      name: "docs bdd units",
      rest: ["checkout-spec"],
    });

    await cliDocs(["bdd", "list", "checkout-spec", "--root", workspace, "--family-only", "--json"]);
    const list = parsedOutput<{ contracts: Array<{ id: string; ownerSystem: string }> }>();
    expect(list.contracts.map((contract) => contract.id)).toContain("checkout.pending.submit.accepted.v1");
    expect(list.contracts[0]).toMatchObject({ ownerSystem: "checkout-system" });

    vi.mocked(console.log).mockClear();
    await cliDocs(["bdd", "validate", "checkout-spec", "--root", workspace, "--family-only", "--json"]);
    const validation = parsedOutput<{ passed: boolean; issues: Array<{ code: string }> }>();
    expect(validation.passed).toBe(true);
    expect(validation.issues).toEqual([]);

    vi.mocked(console.log).mockClear();
    await cliDocs(["bdd", "units", "checkout-spec", "--root", workspace, "--family-only", "--json"]);
    const units = parsedOutput<{
      units: Array<{
        contractId: string;
        testUnits: Array<{ id: string; testFile?: string }>;
        implementationUnits: Array<{ id: string; sourceTarget?: string }>;
      }>;
    }>();
    const group = units.units.find((item) => item.contractId === "checkout.pending.submit.accepted.v1");
    expect(group?.testUnits[0]).toMatchObject({
      id: "TU-checkout-submit-accepted",
      testFile: "packages/checkout/src/checkout-system.test.ts",
    });
    expect(group?.implementationUnits[0]).toMatchObject({
      id: "IU-checkout-submit-operation",
      sourceTarget: "packages/checkout/src/checkout-system.ts",
    });

    vi.mocked(console.log).mockClear();
    await cliDocs(["bdd", "compile", "checkout-spec", "--root", workspace, "--family-only", "--format", "both", "--json"]);
    const compiled = parsedOutput<{
      format: string;
      scenarios: Array<{
        scenario_id: string;
        domain: string;
        steps: Array<{ event_key: string }>;
      }>;
      pipeGraphs: Array<{
        graphId: string;
        pipes: Array<{ pipeId: string }>;
      }>;
      issues: unknown[];
    }>();
    expect(compiled.format).toBe("both");
    expect(compiled.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scenario_id: "checkout.pending.submit.accepted.v1",
        domain: "checkout-system",
        steps: [expect.objectContaining({ event_key: "checkout.submit.requested" })],
      }),
    ]));
    expect(compiled.pipeGraphs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        graphId: "checkout.pending.submit.accepted.v1",
        pipes: [expect.objectContaining({ pipeId: "when" })],
      }),
    ]));
    expect(compiled.issues).toEqual([]);

    vi.mocked(console.log).mockClear();
    await cliDocs(["bdd", "test-plan", "checkout-spec", "--root", workspace, "--family-only", "--json"]);
    const testPlan = parsedOutput<{
      tests: Array<{ testUnitId: string; testName: string; skeleton: string }>;
    }>();
    expect(testPlan.tests[0]).toMatchObject({
      testUnitId: "TU-checkout-submit-accepted",
      testName: "[contract:checkout.pending.submit.accepted.v1] state-transition integration",
    });
    expect(testPlan.tests[0]?.skeleton).toContain("[contract:checkout.pending.submit.accepted.v1]");

    vi.mocked(console.log).mockClear();
    await cliDocs(["bdd", "impl-plan", "checkout-spec", "--root", workspace, "--family-only", "--json"]);
    const implPlan = parsedOutput<{
      sources: Array<{
        sourceTarget: string;
        units: Array<{ id: string; contractId: string; unitKind: string }>;
      }>;
    }>();
    expect(implPlan.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceTarget: "packages/checkout/src/checkout-system.ts",
        units: expect.arrayContaining([
          expect.objectContaining({
            id: "IU-checkout-submit-operation",
            contractId: "checkout.pending.submit.accepted.v1",
            unitKind: "operation",
          }),
        ]),
      }),
    ]));
  });

  it("[contract:docs-control-plane.bdd.cli.validate-contracts.v1] validates BDD units across same-family cases and test docs", async () => {
    const workspace = await createFixtureWorkspace();
    await writeFile(join(workspace, "docs/specs/checkout/checkout.cases.md"), `---
def:
  id: checkout-cases
  level: leaf
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
familyId: docs/specs/checkout/checkout
---
# Checkout Cases

## 목적 ^purpose

Define checkout BDD contracts.

\`\`\`yaml bdd
bdd_contracts:
  - id: checkout.pending.submit.accepted.v1
    owner_system: checkout-system
    contract_kind: state-transition
    mode: write
    given:
      state: PENDING
      predicates: [cart.exists]
    when:
      operation: checkout-system.submit
    then:
      state: ACCEPTED
  - id: checkout.pending.submit.permission-denied.v1
    owner_system: checkout-system
    contract_kind: validation-failure
    mode: write
    given:
      state: PENDING
      predicates: ["!actor.can_submit"]
    when:
      operation: checkout-system.submit
    then:
      error:
        code: permission_denied
\`\`\`
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout.test.md"), `---
def:
  id: checkout-test
  level: leaf
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: approved
familyId: docs/specs/checkout/checkout
---
# Checkout Test

## 목적 ^purpose

Validate checkout BDD contracts.

\`\`\`yaml bdd
test_units:
  - id: TU-checkout-submit-accepted
    contract: checkout.pending.submit.accepted.v1
    level: integration
    assertions: [then.state]
implementation_units:
  - id: IU-checkout-submit-operation
    contract: checkout.pending.submit.accepted.v1
    unit_kind: operation
    owned_by: checkout-system
  - id: IU-checkout-submit-permission-guard
    contract: checkout.pending.submit.permission-denied.v1
    unit_kind: guard
    owned_by: checkout-system
test_unit:
  id: TU-checkout-submit-permission-denied
  contract: checkout.pending.submit.permission-denied.v1
  level: unit
  assertions: [then.error]
\`\`\`
`);

    await cliDocs(["bdd", "validate", "checkout-spec", "--root", workspace, "--family-only", "--json"]);

    const validation = parsedOutput<{ passed: boolean; issues: Array<{ code: string }> }>();
    expect(validation.passed).toBe(true);
    expect(validation.issues).toEqual([]);
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

  it("keeps transient session state out of family-only status unless requested", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["status", "tasks/checkout-prd", "--root", workspace, "--family-only", "--json"]);

    const result = parsedOutput<{
      counts: { familyMembers: number; diagnostics: number };
      nextFollowUps: Array<{ kind: string; path: string }>;
      diagnostics: Array<{ rawSource?: { path?: string } }>;
    }>();
    expect(result.counts.familyMembers).toBe(2);
    expect(result.nextFollowUps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "ralph-session", path: ".ralph-tui/session-meta.json" }),
      ]),
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.rawSource?.path)).not.toContain(
      ".ralph-tui/session-meta.json",
    );

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "status",
      "tasks/checkout-prd",
      "--root",
      workspace,
      "--family-only",
      "--include-session",
      "--json",
    ]);
    const withSession = parsedOutput<{
      nextFollowUps: Array<{ kind: string; path: string }>;
      diagnostics: Array<{ rawSource?: { path?: string } }>;
    }>();
    expect(withSession.nextFollowUps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "ralph-session", path: ".ralph-tui/session-meta.json" }),
      ]),
    );
    expect(withSession.diagnostics.map((diagnostic) => diagnostic.rawSource?.path)).toContain(
      ".ralph-tui/session-meta.json",
    );
  });

  it("uses composition traversal to find module follow-up TODOs outside the same filename family", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/module"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/module/module.spec.md"), `---
def:
  id: module-spec
  level: module
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  links:
    - target: module-follow-up
      type: contains
---
# Module Spec

## 목적 ^purpose

Coordinate module follow-up state.
`);
    await writeFile(join(workspace, "docs/specs/module/module-follow-up.todo.md"), `---
def:
  id: module-follow-up
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  links:
    - target: module-spec
      type: refines
---
# Module Follow Up

## 목적 ^purpose

Track module follow-up work.

- [ ] Close module follow-up.
`);

    await cliDocs(["status", "module-spec", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      nextFollowUp: { kind: string; documentId: string; path: string; title: string; category: string };
      nextFollowUps: Array<{ kind: string; documentId: string; path: string; title: string; category: string }>;
      counts: { familyMembers: number; relatedDocuments: number };
    }>();
    expect(result.nextFollowUp).toMatchObject({
      kind: "todo",
      documentId: "module-follow-up",
      path: "docs/specs/module/module-follow-up.todo.md",
      title: "Close module follow-up.",
      category: "uncategorized",
    });
    expect(result.nextFollowUps).toEqual([
      expect.objectContaining({ title: "Close module follow-up.", category: "uncategorized" }),
    ]);
    expect(result.counts.familyMembers).toBeGreaterThanOrEqual(2);
    expect(result.counts.relatedDocuments).toBe(result.counts.familyMembers);
  });

  it("prints JSON status for source paths without widening to workspace status", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["status", "packages/checkout/src/index.ts", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      target: string;
      sourceTarget: {
        path: string;
        matches: Array<{ document: { stableId: string; path: string }; source: { path?: string; label?: string } }>;
        limitation: string;
      };
      counts: { documents: number; familyMembers: number; diagnostics: number };
      diagnostics: Array<{ rawSource?: { path?: string } }>;
    }>();
    expect(result.target).toBe("packages/checkout/src/index.ts");
    expect(result).not.toHaveProperty("document");
    expect(result.sourceTarget).toMatchObject({
      path: "packages/checkout/src/index.ts",
      limitation: expect.stringContaining("limited to documents that declare this path"),
    });
    expect(result.sourceTarget.matches).toEqual([
      expect.objectContaining({
        document: expect.objectContaining({
          stableId: "checkout-spec",
          path: "docs/specs/checkout/checkout.spec.md",
        }),
        source: expect.objectContaining({
          path: "packages/checkout/src/index.ts",
          label: "Checkout",
        }),
      }),
    ]);
    expect(result.counts.documents).toBeGreaterThan(result.counts.familyMembers);
    expect(result.counts.familyMembers).toBe(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.rawSource?.path)).not.toContain(
      "tasks/unrelated-prd.json",
    );
  });

  it("collects source paths without widening to full-repository results", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["collect", "packages/checkout/src/index.ts", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      sourceTarget: {
        path: string;
        matches: Array<{ document: { stableId: string; path: string } }>;
      };
      familyMembers: Array<{ stableId: string; path: string }>;
      counts: { documents: number; familyMembers: number };
      diagnostics: Array<{ rawSource?: { path?: string } }>;
    }>();
    expect(result.sourceTarget.path).toBe("packages/checkout/src/index.ts");
    expect(result.sourceTarget.matches).toEqual([
      expect.objectContaining({
        document: expect.objectContaining({
          stableId: "checkout-spec",
          path: "docs/specs/checkout/checkout.spec.md",
        }),
      }),
    ]);
    expect(result.familyMembers).toEqual([
      expect.objectContaining({
        stableId: "checkout-spec",
        path: "docs/specs/checkout/checkout.spec.md",
      }),
    ]);
    expect(result.counts.documents).toBeGreaterThan(result.counts.familyMembers);
    expect(result.counts.familyMembers).toBe(1);
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
      ]),
    );
    expect(result.metadata.map((item) => item.stableId)).toContain("checkout-spec");
    expect(result.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "depends_on", targetId: "checkout-plan" }),
      ]),
    );
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "packages/checkout/src/index.ts" }),
      ]),
    );
    expect(result.tasks).toEqual([]);
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it("collects explicit graph traversal results without changing the default family mode", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "collect",
      "checkout-spec",
      "--root",
      workspace,
      "--graph",
      "--preset",
      "implementation",
      "--json",
    ]);

    const result = parsedOutput<{
      graph: GraphOutput;
      familyMembers: Array<{ stableId: string; kind: string }>;
      counts: { familyMembers: number };
    }>();
    expect(result.graph.input).toMatchObject({
      axes: ["trace", "source", "evidence"],
      direction: "both",
      depth: 2,
      includeContext: false,
      preset: "implementation",
    });
    expect(result.graph.edges.map((edge) => edge.axis)).toEqual(
      expect.arrayContaining(["source"]),
    );
    expect(result.graph.ranking).toMatchObject({
      algorithm: "docs-graph-rule-rank-v1",
      rankedNodes: result.graph.rankedNodes,
    });
    expect(result.graph.summary).toMatchObject({
      algorithm: "docs-graph-result-summary-v1",
      scope: "filtered",
      nodes: result.graph.rankedNodes.length,
    });
    expect(result.graph.rankedNodes.map((node) => node.rank)).toEqual(
      result.graph.rankedNodes.map((_, index) => index + 1),
    );
    expect(new Set(result.graph.rankedNodes.map((node) => node.nodeId))).toEqual(
      new Set(result.graph.nodes.map((node) => node.id)),
    );
    expect(result.familyMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec", kind: "spec" }),
        expect.objectContaining({ stableId: "checkout-evidence", kind: "activation-evidence" }),
      ]),
    );
    expect(result.counts.familyMembers).toBe(result.familyMembers.length);
  });

  it("keeps collect graph text concise while surfacing a ranked summary", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "collect",
      "checkout-spec",
      "--graph",
      "--preset",
      "family",
      "--root",
      workspace,
    ]);

    const text = output();
    expect(text).toContain("docs collect: checkout-spec");
    expect(text).toContain("graph view:");
    expect(text).toContain("active ranked nodes:");
    expect(text).toContain("view nodes/edges/paths:");
    expect(text).toContain("top ranked:");
    expect(text).toContain("family members (");
    expect(text).not.toContain("ranked view (");
    expect(text).not.toContain("raw traversal");
    expect(text).not.toContain("edge reasons");
  });

  it("applies graph filters to collect returned views while preserving raw graph traversal", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "collect",
      "checkout-spec",
      "--graph",
      "--preset",
      "family",
      "--kind",
      "todo",
      "--role",
      "todo",
      "--follow-up-category",
      "actionable",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<{
      familyMembers: Array<{ stableId: string; kind: string }>;
      graph: GraphOutput;
      counts: { familyMembers: number };
    }>();
    expect(result.graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["document:checkout-spec", "document:checkout-todo"]),
    );
    expect(result.graph.rankedNodes.map((node) => node.nodeId)).toEqual([
      "document:checkout-todo",
    ]);
    expect(result.graph.ranking.rankedNodes).toEqual(result.graph.rankedNodes);
    expect(result.graph.summary).toMatchObject({
      nodes: 1,
      counts: {
        byNodeKind: { todo: 1 },
        byDocumentRole: { todo: 1 },
        byFollowUpCategory: { actionable: 1 },
      },
    });
    expect(result.familyMembers).toEqual([
      expect.objectContaining({ stableId: "checkout-todo", kind: "todo" }),
    ]);
    expect(result.counts.familyMembers).toBe(result.familyMembers.length);
  });

  it("limits collect inventory to same-family roles and direct module children with --family-only", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/module"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/module/module.spec.md"), `---
def:
  id: module-spec
  level: module
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  links:
    - target: module-child
      type: contains
    - target: checkout-spec
      type: depends_on
---
# Module Spec

## 목적 ^purpose

Coordinate module inventory.
`);
    await writeFile(join(workspace, "docs/specs/module/module.plan.md"), `---
def:
  id: module-plan
  level: leaf
  scope: interface
  aspect: api_contract
  depth: implementation
  lifecycle: draft
---
# Module Plan

## 목적 ^purpose

Plan module inventory.
`);
    await writeFile(join(workspace, "docs/specs/module/module-child.spec.md"), `---
def:
  id: module-child
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
---
# Module Child

## 목적 ^purpose

Define the direct module child.
`);

    await cliDocs([
      "collect",
      "module-spec",
      "--root",
      workspace,
      "--graph",
      "--preset",
      "family",
      "--family-only",
      "--json",
    ]);

    const result = parsedOutput<{
      familyMembers: Array<{ stableId: string; kind: string; path: string }>;
      graph: GraphOutput;
      counts: { familyMembers: number };
    }>();
    expect(result.graph.input.preset).toBe("family");
    expect(result.graph.ranking).toMatchObject({
      algorithm: "docs-graph-rule-rank-v1",
      rankedNodes: result.graph.rankedNodes,
    });
    expect(result.graph.summary).toMatchObject({
      algorithm: "docs-graph-result-summary-v1",
      scope: "filtered",
      edges: 0,
      paths: 0,
    });
    expect(result.graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "document:module-spec",
        "document:module-plan",
        "document:module-child",
      ]),
    );
    expect(result.graph.nodes.map((node) => node.id)).not.toContain("document:checkout-spec");
    expect(result.graph.rankedNodes.map((node) => node.nodeId)).not.toContain("document:checkout-spec");
    expect(result.familyMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "module-spec", kind: "spec" }),
        expect.objectContaining({ stableId: "module-plan", kind: "plan" }),
        expect.objectContaining({ stableId: "module-child", kind: "spec" }),
      ]),
    );
    expect(result.familyMembers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec" }),
        expect.objectContaining({ stableId: "checkout-evidence" }),
      ]),
    );
    expect(result.counts.familyMembers).toBe(result.familyMembers.length);
    expect(result.counts.relatedDocuments).toBe(result.familyMembers.length);
  });

  it("exposes a role matrix that separates same-family and linked role documents", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "tasks/archive"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/checkout/checkout.cases.md"), `---
def:
  id: checkout-cases
  level: leaf
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: approved
---
# Checkout Cases

## 목적 ^purpose

Capture checkout user flows.
`);
    await writeFile(join(workspace, "tasks/archive/checkout-archive-prd.md"), `[PRD]
# PRD: Archived Checkout PRD

## Overview

Archived checkout work.

## User Stories

### US-001: Archived checkout story

**Description:** Archived story.

**Acceptance Criteria:**
- [x] Archived criterion.
[/PRD]
`);
    await writeFile(join(workspace, "tasks/archive/checkout-archive-prd.json"), JSON.stringify({
      name: "Archived Checkout PRD",
      branchName: "ralph/checkout-archive",
      description: "Archived checkout work.",
      userStories: [
        {
          id: "US-001",
          title: "Archived checkout story",
          description: "Archived story.",
          acceptanceCriteria: ["Archived criterion."],
          priority: 1,
          passes: true,
          dependsOn: [],
        },
      ],
    }, null, 2));

    await cliDocs(["status", "checkout-spec", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      roleCoverage: {
        familyId: string;
        roles: Array<{
          role: string;
          present: boolean;
          sameFamilyPresent: boolean;
          linkedPresent: boolean;
          sameFamily: Array<{ stableId: string; kind: string; path: string }>;
          linked: Array<{
            stableId: string;
            kind: string;
            path: string;
            relation: string;
            linkType: string;
            direction: string;
          }>;
        }>;
        missingRoles: string[];
        missingSameFamilyRoles: string[];
        typeCoverage: {
          types: Array<{
            type: string;
            sameFamily: Array<{ stableId: string; kind: string; path: string }>;
          }>;
        };
      };
    }>();
    const role = (name: string) => result.roleCoverage.roles.find((item) => item.role === name)!;
    const typeCoverage = (name: string) => result.roleCoverage.typeCoverage.types.find((item) => item.type === name)!;

    expect(result.roleCoverage.familyId).toBe("docs/specs/checkout/checkout");
    expect(result.roleCoverage.roles.map((item) => item.role)).toEqual([
      "spec",
      "plan",
      "todo",
      "rule",
      "cases",
      "test",
      "memo",
      "prd",
      "ralph-prd-json",
    ]);
    expect(role("cases")).toMatchObject({
      present: true,
      sameFamilyPresent: true,
      linkedPresent: false,
    });
    expect(role("cases").sameFamily).toEqual([
      expect.objectContaining({ stableId: "checkout-cases", kind: "cases" }),
    ]);
    expect(role("spec").sameFamily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec", path: "docs/specs/checkout/checkout.spec.md" }),
      ]),
    );
    expect(role("spec").linked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-child", relation: "composition", linkType: "contains" }),
        expect.objectContaining({ stableId: "checkout-refinement", relation: "refinement", linkType: "refines" }),
      ]),
    );
    expect(role("spec").sameFamily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-knowledge", kind: "spec" }),
      ]),
    );
    expect(typeCoverage("knowledge").sameFamily).toEqual([
      expect.objectContaining({ stableId: "checkout-knowledge", kind: "spec" }),
    ]);
    expect(role("prd").sameFamily).toEqual([]);
    expect(role("prd").linked).toEqual([
      expect.objectContaining({ stableId: "tasks/checkout-prd", relation: "trace", linkType: "traces_to" }),
    ]);
    expect(role("ralph-prd-json").linked).toEqual([
      expect.objectContaining({ stableId: "tasks/checkout-prd", relation: "trace", linkType: "traces_to" }),
    ]);
    expect(role("prd").linked.map((document) => document.path)).not.toContain(
      "tasks/archive/checkout-archive-prd.md",
    );
    expect(role("ralph-prd-json").linked.map((document) => document.path)).not.toContain(
      "tasks/archive/checkout-archive-prd.json",
    );
    expect(result.roleCoverage.missingRoles).toEqual([]);
    expect(result.roleCoverage.missingSameFamilyRoles).toEqual([
      "prd",
      "ralph-prd-json",
    ]);
  });

  it("reports missing role documents for sparse active families", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/matrix"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/matrix/matrix.spec.md"), `---
def:
  id: matrix-spec
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
---
# Matrix Spec

## 목적 ^purpose

Define sparse role coverage.
`);
    await writeFile(join(workspace, "docs/specs/matrix/matrix.todo.md"), `---
def:
  id: matrix-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Matrix Todo

## 목적 ^purpose

Track sparse role follow-up.

- [ ] Add missing role documents.
`);

    await cliDocs(["status", "matrix-spec", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      roleCoverage: {
        roles: Array<{
          role: string;
          sameFamilyPresent: boolean;
          linkedPresent: boolean;
          sameFamily: Array<{ stableId: string }>;
        }>;
        missingRoles: string[];
        missingSameFamilyRoles: string[];
      };
    }>();
    const role = (name: string) => result.roleCoverage.roles.find((item) => item.role === name)!;

    expect(role("spec")).toMatchObject({
      sameFamilyPresent: true,
      linkedPresent: false,
    });
    expect(role("todo").sameFamily).toEqual([
      expect.objectContaining({ stableId: "matrix-todo" }),
    ]);
    expect(role("plan").sameFamilyPresent).toBe(false);
    expect(role("cases").sameFamilyPresent).toBe(false);
    expect(result.roleCoverage.missingRoles).toEqual([
      "plan",
      "rule",
      "cases",
      "test",
      "memo",
      "prd",
      "ralph-prd-json",
    ]);
    expect(result.roleCoverage.missingSameFamilyRoles).toEqual(result.roleCoverage.missingRoles);
  });

  it("summarizes lifecycle artifacts, work topics, and prune candidates for the target family", async () => {
    const workspace = await createFixtureWorkspace();
    await writeFile(join(workspace, "packages/cli/src/commands/docs.ts"), "export const docsCommand = true;\n");
    await writeFile(join(workspace, "packages/cli/src/commands/docs.test.ts"), "export const docsCommandTest = true;\n");
    await writeFile(join(workspace, "docs/specs/checkout/checkout.todo.md"), `---
def:
  id: checkout-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Checkout Todo

## 목적 ^purpose

Track completed checkout follow-up.

## Completed — 완료 기록

- [x] Remove obsolete checkout stub.
- [x] Sync PRD completion ledger.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout.plan.md"), `---
def:
  id: checkout-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Checkout Plan

## 목적 ^purpose

Plan checkout adapter follow-up work.

\`\`\`yaml work-topic
work_topic:
  id: checkout.submit.readiness.v1
  owner_system: checkout-system
  goal: close checkout submit lifecycle
  topic_kind: feature-delivery
  contracts:
    - checkout.pending.submit.accepted.v1
  source_targets:
    - packages/cli/src/commands/docs.ts:cliDocs
  proof_surface:
    - packages/cli/src/commands/docs.test.ts#lifecycle
  assimilation_target:
    - docs/specs/checkout/checkout.spec.md#current
\`\`\`
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout.cases.md"), `---
def:
  id: checkout-cases
  level: leaf
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
---
# Checkout Cases

## 목적 ^purpose

Define checkout lifecycle contracts.

\`\`\`yaml bdd
bdd_contract:
  id: checkout.pending.submit.accepted.v1
  owner_system: checkout-system
  contract_kind: state-transition
  mode: write
  given:
    state: PENDING
    predicates: [cart.exists]
  when:
    operation: checkout-system.submit
  then:
    state: ACCEPTED
\`\`\`
`);

    await cliDocs(["status", "checkout-spec", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      lifecycle: {
        artifacts: Array<{
          role: string;
          present: boolean;
          sameFamilyPresent: boolean;
        }>;
        workTopics: Array<{
          id: string;
          ownerSystem: string;
          sourcePath: string;
          readiness: {
            contractsDeclared: boolean;
            contractsLinked: boolean;
            sourceTargetsPresent: boolean;
            proofSurfacePresent: boolean;
            assimilationTargetPresent: boolean;
          };
        }>;
        diagnostics: Array<{ code: string }>;
        pruneCandidates: Array<{ documentId: string; path: string }>;
        counts: {
          artifactsPresent: number;
          workTopics: number;
          diagnostics: number;
          pruneCandidates: number;
        };
      };
    }>();
    const artifact = (name: string) => result.lifecycle.artifacts.find((item) => item.role === name)!;

    expect(artifact("spec")).toMatchObject({ present: true, sameFamilyPresent: true });
    expect(artifact("plan")).toMatchObject({ present: true, sameFamilyPresent: true });
    expect(artifact("todo")).toMatchObject({ present: true, sameFamilyPresent: true });
    expect(artifact("cases")).toMatchObject({ present: true, sameFamilyPresent: true });
    expect(artifact("test")).toMatchObject({ present: true, sameFamilyPresent: true });
    expect(result.lifecycle.workTopics).toEqual([
      expect.objectContaining({
        id: "checkout.submit.readiness.v1",
        ownerSystem: "checkout-system",
        sourcePath: "docs/specs/checkout/checkout.plan.md",
        readiness: expect.objectContaining({
          contractsDeclared: true,
          contractsLinked: true,
          sourceTargetsPresent: true,
          proofSurfacePresent: true,
          assimilationTargetPresent: true,
        }),
      }),
    ]);
    expect(result.lifecycle.diagnostics).toEqual([]);
    expect(result.lifecycle.pruneCandidates).toEqual([
      expect.objectContaining({
        documentId: "checkout-todo",
        path: "docs/specs/checkout/checkout.todo.md",
      }),
    ]);
    expect(result.lifecycle.counts).toEqual({
      artifactsPresent: 5,
      workTopics: 1,
      diagnostics: 0,
      pruneCandidates: 1,
    });
  });

  it("resolves work topic contracts from linked and external BDD families", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/provider"), { recursive: true });
    await writeFile(join(workspace, "packages/cli/src/commands/docs.ts"), "export const docsCommand = true;\n");
    await writeFile(join(workspace, "packages/cli/src/commands/docs.test.ts"), "export const docsCommandTest = true;\n");
    await writeFile(join(workspace, "docs/specs/provider/provider.cases.md"), `---
def:
  id: provider-cases
  level: leaf
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
---
# Provider Cases

## 목적 ^purpose

Define provider behavior contracts.

\`\`\`yaml bdd
bdd_contract:
  id: provider.lookup.available.v1
  owner_system: provider-system
  contract_kind: query-projection
  mode: read
  given:
    predicates: [provider.exists]
  when:
    operation: provider.lookup
  then:
    returns:
      provider: present
\`\`\`
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout.plan.md"), `---
def:
  id: checkout-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Checkout Plan

## 목적 ^purpose

Plan checkout integration with an external provider contract.

\`\`\`yaml work-topic
work_topic:
  id: checkout.provider.lookup.v1
  owner_system: checkout-system
  goal: consume provider lookup behavior
  topic_kind: feature-delivery
  contracts:
    - provider.lookup.available.v1
  source_targets:
    - packages/cli/src/commands/docs.ts:cliDocs
  proof_surface:
    - packages/cli/src/commands/docs.test.ts#provider
  assimilation_target:
    - docs/specs/checkout/checkout.spec.md#provider
\`\`\`
`);

    await cliDocs(["status", "checkout-spec", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      lifecycle: {
        workTopics: Array<{
          id: string;
          readiness: {
            contractsLinked: boolean;
            sourceTargetsPresent: boolean;
            proofSurfacePresent: boolean;
            assimilationTargetPresent: boolean;
          };
        }>;
        diagnostics: Array<{ code: string; topicId?: string }>;
      };
    }>();

    expect(result.lifecycle.workTopics).toEqual([
      expect.objectContaining({
        id: "checkout.provider.lookup.v1",
        readiness: expect.objectContaining({
          contractsLinked: true,
          sourceTargetsPresent: true,
          proofSurfacePresent: true,
          assimilationTargetPresent: true,
        }),
      }),
    ]);
    expect(result.lifecycle.diagnostics.map((item) => item.code)).not.toContain("work-topic-contract-unresolved");
  });

  it("excludes archive PRDs and ralph sessions from family-only PRD context by default", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "tasks/archive"), { recursive: true });
    await writeFile(join(workspace, "tasks/archive/checkout-archive-prd.md"), `[PRD]
# PRD: Archived Checkout PRD

## Overview

Archived checkout work.

## User Stories

### US-ARCHIVE: Archived checkout story

**Description:** Archived story.

**Acceptance Criteria:**
- [x] Archived criterion.
[/PRD]
`);
    await writeFile(join(workspace, "tasks/archive/checkout-archive-prd.json"), JSON.stringify({
      name: "Archived Checkout PRD",
      branchName: "ralph/checkout-archive",
      description: "Archived checkout work.",
      userStories: [
        {
          id: "US-ARCHIVE",
          title: "Archived checkout story",
          description: "Archived story.",
          acceptanceCriteria: ["Archived criterion."],
          priority: 1,
          passes: true,
          dependsOn: [],
        },
      ],
    }, null, 2));

    await cliDocs(["prd", "context", "checkout", "--root", workspace, "--family-only", "--json"]);
    const result = parsedOutput<{
      priorPrds: Array<{ path: string }>;
      prdJsonCompletion: Array<{ path: string }>;
      ralphSessionState: Array<{ path: string }>;
    }>();
    expect(result.priorPrds.map((prd) => prd.path)).not.toContain("tasks/archive/checkout-archive-prd.md");
    expect(result.prdJsonCompletion.map((prd) => prd.path)).not.toContain("tasks/archive/checkout-archive-prd.json");
    expect(result.ralphSessionState).toEqual([]);

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "prd",
      "context",
      "checkout",
      "--root",
      workspace,
      "--family-only",
      "--include-session",
      "--json",
    ]);
    const withSession = parsedOutput<{
      ralphSessionState: Array<{ path: string; status?: string }>;
    }>();
    expect(withSession.ralphSessionState).toEqual([
      expect.objectContaining({ path: ".ralph-tui/session-meta.json", status: "running" }),
    ]);
  });

  it("prints compact text graph traversal by default and verbose details on request", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "composition",
      "--direction",
      "out",
      "--depth",
      "1",
      "--root",
      workspace,
    ]);

    const text = output();
    expect(text).toContain("docs graph: checkout-spec");
    expect(text).toContain("axes: composition");
    expect(text).toContain("direction: out");
    expect(text).toContain("node count:");
    expect(text).toContain("edge count:");
    expect(text).toContain("truncated: yes");
    expect(text).toContain("graph stats:");
    expect(text).toContain("node kinds:");
    expect(text).toContain("traversal axes:");
    expect(text).toContain("ranked view");
    expect(text).toContain("#1 [spec] document:checkout-spec");
    expect(text.indexOf("ranked view")).toBeLessThan(text.indexOf("graph stats:"));
    expect(text).not.toContain("nodes (");
    expect(text).not.toContain("edge reasons");

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "composition",
      "--direction",
      "out",
      "--depth",
      "1",
      "--root",
      workspace,
      "--verbose",
    ]);

    const verbose = output();
    expect(verbose).toContain("nodes (");
    expect(verbose).toContain("edge reasons");
    expect(verbose).toContain("reason: link:contains");
  });

  it("prints graph guardrail truncation and broad context warnings", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "role",
      "--direction",
      "out",
      "--limit",
      "2",
      "--root",
      workspace,
    ]);

    const limitedText = output();
    expect(limitedText).toContain("limit: 2");
    expect(limitedText).toContain("truncated: yes (omitted");
    expect(limitedText).toContain("node(s)");

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "context",
      "--root",
      workspace,
    ]);

    const contextText = output();
    expect(contextText).toContain("axes: context");
    expect(contextText).toContain("warning: context/search traversal is broad");
  });

  it("adds deterministic ranked graph metadata without changing raw graph fields", async () => {
    const workspace = await createFixtureWorkspace();
    const args = [
      "graph",
      "checkout-spec",
      "--preset",
      "family",
      "--root",
      workspace,
      "--json",
    ];

    await cliDocs(args);
    const first = parsedOutput<GraphOutput>();
    const rawNodeIds = first.nodes.map((node) => node.id);
    const rankedNodeIds = first.rankedNodes.map((node) => node.nodeId);

    expect(first).toMatchObject({
      counts: expect.objectContaining({
        nodes: expect.any(Number),
        edges: expect.any(Number),
        paths: expect.any(Number),
        diagnostics: expect.any(Number),
      }),
      truncated: expect.any(Boolean),
      omittedCount: expect.any(Number),
      omittedCounts: expect.objectContaining({
        nodes: expect.any(Number),
        edges: expect.any(Number),
        depth: expect.any(Number),
      }),
    });
    expect(Array.isArray(first.nodes)).toBe(true);
    expect(Array.isArray(first.edges)).toBe(true);
    expect(Array.isArray(first.paths)).toBe(true);
    expect(Array.isArray(first.diagnostics)).toBe(true);
    expect(first.ranking).toMatchObject({
      algorithm: "docs-graph-rule-rank-v1",
      counts: expect.objectContaining({
        strong: expect.any(Number),
        medium: expect.any(Number),
        weak: expect.any(Number),
        penalized: expect.any(Number),
      }),
    });
    expect(first.summary).toMatchObject({
      algorithm: "docs-graph-result-summary-v1",
      scope: "filtered",
      nodes: first.rankedNodes.length,
      edges: expect.any(Number),
      paths: expect.any(Number),
      diagnostics: expect.any(Number),
      diagnosticCounts: {
        traversal: expect.any(Number),
        node: expect.any(Number),
        bySeverity: expect.objectContaining({
          error: expect.any(Number),
          warning: expect.any(Number),
          info: expect.any(Number),
        }),
      },
      archive: {
        included: expect.any(Number),
        excluded: expect.any(Number),
      },
      counts: {
        byNodeKind: expect.objectContaining({
          spec: expect.any(Number),
          todo: expect.any(Number),
        }),
        byTraversalAxis: expect.objectContaining({
          role: expect.any(Number),
        }),
        byDocumentRole: expect.objectContaining({
          spec: expect.any(Number),
          todo: expect.any(Number),
        }),
        byFollowUpCategory: expect.objectContaining({
          actionable: expect.any(Number),
        }),
      },
    });
    expect(first.ranking.rankedNodes).toEqual(first.rankedNodes);
    expect(rankedNodeIds).toHaveLength(rawNodeIds.length);
    expect(new Set(rankedNodeIds)).toEqual(new Set(rawNodeIds));
    expect(first.rankedNodes.map((node) => node.rank)).toEqual(
      first.rankedNodes.map((_, index) => index + 1),
    );

    const targetRank = first.rankedNodes.find((node) => node.nodeId === "document:checkout-spec");
    expect(targetRank).toMatchObject({
      nodeId: "document:checkout-spec",
      rank: 1,
      score: expect.any(Number),
      strength: "strong",
      reasonSummary: expect.arrayContaining([
        expect.stringContaining("target"),
      ]),
    });
    expect(targetRank?.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factor: "target",
          score: expect.any(Number),
          reason: "target node",
          metadata: expect.objectContaining({
            nodeId: "document:checkout-spec",
            target: true,
          }),
        }),
        expect.objectContaining({
          factor: "distance",
          score: expect.any(Number),
          reason: "path distance 0",
          metadata: expect.objectContaining({
            depth: 0,
            pathLength: 0,
          }),
        }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs(args);
    const second = parsedOutput<GraphOutput>();

    expect(second.nodes.map((node) => node.id)).toEqual(rawNodeIds);
    expect(second.ranking).toEqual(first.ranking);
    expect(second.rankedNodes).toEqual(first.rankedNodes);
  });

  it("ranks source-path graph output while preserving bounded raw traversal", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "graph",
      "packages/checkout/src/index.ts",
      "--axis",
      "source",
      "--direction",
      "in",
      "--depth",
      "1",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<GraphOutput>();
    const rawNodeIds = result.nodes.map((node) => node.id);
    const rankedNodeIds = result.rankedNodes.map((node) => node.nodeId);

    expect(result.targetResolution.lookupKind).toBe("source-path");
    expect(result.ranking.algorithm).toBe("docs-graph-rule-rank-v1");
    expect(result.summary.algorithm).toBe("docs-graph-result-summary-v1");
    expect(rawNodeIds).toEqual([
      "source:packages/checkout/src/index.ts",
      "document:checkout-spec",
    ]);
    expect(rankedNodeIds).toEqual([
      "source:packages/checkout/src/index.ts",
      "document:checkout-spec",
    ]);
    expect(result.rankedNodes[0]).toMatchObject({
      nodeId: "source:packages/checkout/src/index.ts",
      rank: 1,
      strength: "strong",
    });
    expect(result.rankedNodes[0]?.reasonSummary).toEqual(
      expect.arrayContaining([
        expect.stringContaining("target"),
        expect.stringContaining("source"),
      ]),
    );
    expect(new Set(rankedNodeIds)).toEqual(new Set(rawNodeIds));
    expect(rawNodeIds).not.toContain("document:tasks/unrelated-prd");
    expect(result.edges).toEqual([
      expect.objectContaining({
        axis: "source",
        fromNodeId: "document:checkout-spec",
        toNodeId: "source:packages/checkout/src/index.ts",
      }),
    ]);
  });

  it("keeps missing source-path graph output bounded with ranked diagnostic views", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "graph",
      "packages/missing/src/nope.ts",
      "--axis",
      "source",
      "--direction",
      "both",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<GraphOutput>();

    expect(result.targetResolution.lookupKind).toBe("source-path-missing");
    expect(result.targetResolution.indexed).toBe(false);
    expect(result.counts).toMatchObject({
      nodes: 1,
      edges: 0,
      paths: 1,
      diagnostics: 1,
    });
    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: "source:packages/missing/src/nope.ts",
        kind: "source",
      }),
    ]);
    expect(result.edges).toEqual([]);
    expect(result.paths).toHaveLength(1);
    expect(result.rankedNodes).toEqual([
      expect.objectContaining({
        nodeId: "source:packages/missing/src/nope.ts",
        rank: 1,
        strength: "strong",
      }),
    ]);
    expect(result.filtering.filteredNodeIds).toEqual([
      "source:packages/missing/src/nope.ts",
    ]);
    expect(result.summary).toMatchObject({
      nodes: 1,
      edges: 0,
      paths: 1,
      diagnostics: 1,
      counts: {
        byNodeKind: { source: 1 },
        byTraversalAxis: {},
      },
    });
    expect(result.diagnostics.join("\n")).toContain("source-map-missing");
    expect(result.nodes.map((node) => node.id)).not.toContain("document:checkout-spec");
  });

  it("filters graph ranked views without changing raw traversal nodes", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "graph",
      "checkout-spec",
      "--preset",
      "family",
      "--kind",
      "todo,plan",
      "--role",
      "todo",
      "--filter-axis",
      "role",
      "--follow-up-category",
      "actionable",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<GraphOutput>();
    expect(result.input).toMatchObject({
      axes: ["composition", "role"],
      preset: "family",
    });
    expect(result.filters).toEqual({
      kinds: ["todo", "plan"],
      roles: ["todo"],
      axes: ["role"],
      followUpCategories: ["actionable"],
      includeArchive: false,
    });
    expect(result.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "document:checkout-spec",
        "document:checkout-plan",
        "document:checkout-todo",
      ]),
    );
    expect(result.rankedNodes.map((node) => node.nodeId)).toEqual([
      "document:checkout-todo",
    ]);
    expect(result.filteredNodes).toEqual(result.rankedNodes);
    expect(result.filtering.filteredNodeIds).toEqual(["document:checkout-todo"]);
    expect(result.filtering.counts.rawRankedNodes).toBe(result.nodes.length);
    expect(result.filtering.counts.excludedByFilters).toBeGreaterThan(0);
    expect(result.summary).toMatchObject({
      nodes: 1,
      counts: {
        byNodeKind: { todo: 1 },
        byTraversalAxis: { role: 1 },
        byDocumentRole: { todo: 1 },
        byFollowUpCategory: { actionable: 1 },
      },
    });
  });

  it("excludes archived documents from active graph views unless requested", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/checkout/archive"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/checkout/archive/checkout-archive.todo.md"), `---
def:
  id: checkout-archive-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: archived
familyId: docs/specs/checkout/checkout
---
# Checkout Archive Todo

## 목적 ^purpose

Archived checkout follow-up.

## Actionable

- [ ] Archived action.
`);

    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "role",
      "--direction",
      "out",
      "--depth",
      "1",
      "--root",
      workspace,
      "--json",
    ]);
    const active = parsedOutput<GraphOutput>();
    expect(active.nodes.map((node) => node.id)).toContain("document:checkout-archive-todo");
    expect(active.rankedNodes.map((node) => node.nodeId)).not.toContain("document:checkout-archive-todo");
    expect(active.filtering.counts.excludedByArchive).toBeGreaterThan(0);
    expect(active.summary.archive.included).toBe(0);
    expect(active.summary.archive.excluded).toBeGreaterThan(0);

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "role",
      "--direction",
      "out",
      "--depth",
      "1",
      "--include-archive",
      "--root",
      workspace,
      "--json",
    ]);
    const withArchive = parsedOutput<GraphOutput>();
    expect(withArchive.rankedNodes.map((node) => node.nodeId)).toContain("document:checkout-archive-todo");
    expect(withArchive.filtering.counts.excludedByArchive).toBe(0);
    expect(withArchive.summary.archive.included).toBeGreaterThan(0);
    expect(withArchive.summary.archive.excluded).toBe(0);
  });

  it("traverses composition, role, source, evidence, trace, and preset graph paths", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "composition",
      "--direction",
      "out",
      "--depth",
      "1",
      "--root",
      workspace,
      "--json",
    ]);
    const composition = parsedOutput<GraphOutput>();
    expect(composition.input.axes).toEqual(["composition"]);
    expect(composition.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          axis: "composition",
          authoredType: "contains",
          fromNodeId: "document:checkout-spec",
          toNodeId: "document:checkout-child",
          reasons: expect.arrayContaining([
            expect.objectContaining({ reason: "link:contains" }),
          ]),
        }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "role",
      "--direction",
      "out",
      "--depth",
      "1",
      "--root",
      workspace,
      "--json",
    ]);
    const role = parsedOutput<GraphOutput>();
    expect(role.edges.every((edge) => edge.axis === "role")).toBe(true);
    expect(role.roleGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roleType: "spec" }),
        expect.objectContaining({ roleType: "todo" }),
        expect.objectContaining({ roleType: "plan" }),
        expect.objectContaining({ roleType: "rule" }),
        expect.objectContaining({ roleType: "cases" }),
        expect.objectContaining({ roleType: "test" }),
        expect.objectContaining({ roleType: "memo" }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "packages/checkout/src/index.ts",
      "--axis",
      "source",
      "--direction",
      "in",
      "--depth",
      "1",
      "--root",
      workspace,
      "--json",
    ]);
    const source = parsedOutput<GraphOutput>();
    expect(source.targetResolution.lookupKind).toBe("source-path");
    expect(source.counts.nodes).toBe(2);
    expect(source.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["source:packages/checkout/src/index.ts", "document:checkout-spec"]),
    );
    expect(source.nodes.map((node) => node.id)).not.toContain("document:tasks/unrelated-prd");
    expect(source.edges.every((edge) => edge.axis === "source")).toBe(true);
    expect(source.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          axis: "source",
          fromNodeId: "document:checkout-spec",
          toNodeId: "source:packages/checkout/src/index.ts",
        }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "checkout-evidence",
      "--axis",
      "evidence",
      "--direction",
      "out",
      "--depth",
      "1",
      "--root",
      workspace,
      "--json",
    ]);
    const evidence = parsedOutput<GraphOutput>();
    expect(evidence.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          axis: "evidence",
          authoredType: "verifies",
          fromNodeId: "document:checkout-evidence",
          toNodeId: "document:checkout-evidence",
          reasons: expect.arrayContaining([
            expect.objectContaining({ reason: "link:verifies" }),
          ]),
        }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "checkout-spec",
      "--axis",
      "trace",
      "--direction",
      "out",
      "--depth",
      "1",
      "--root",
      workspace,
      "--json",
    ]);
    const trace = parsedOutput<GraphOutput>();
    expect(trace.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          axis: "trace",
          authoredType: "traces_to",
          fromNodeId: "document:checkout-spec",
          toNodeId: "task:tasks/checkout-prd:US-001",
        }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "graph",
      "checkout-spec",
      "--preset",
      "implementation",
      "--root",
      workspace,
      "--json",
    ]);
    const preset = parsedOutput<GraphOutput>();
    expect(preset.input).toMatchObject({
      preset: "implementation",
      axes: ["trace", "source", "evidence"],
      direction: "both",
      depth: 2,
    });
    expect(preset.counts.nodes).toBeGreaterThan(1);
    expect(preset.edges.map((edge) => edge.axis)).toEqual(
      expect.arrayContaining(["trace", "source"]),
    );
  });

  it("returns structured errors for unknown graph axis, direction, and preset", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["graph", "checkout-spec", "--axis", "unknown", "--root", workspace, "--json"]);
    expect(parsedOutput<{ error: { code: string; operation: string; remediation: string } }>().error).toMatchObject({
      code: "unknown-docs-graph-axis",
      operation: "docs.graph",
      remediation: expect.stringContaining("composition"),
    });
    expect(process.exitCode).toBe(1);

    vi.mocked(console.log).mockClear();
    process.exitCode = undefined;
    await cliDocs(["graph", "checkout-spec", "--direction", "sideways", "--root", workspace, "--json"]);
    expect(parsedOutput<{ error: { code: string; operation: string; remediation: string } }>().error).toMatchObject({
      code: "unknown-docs-graph-direction",
      operation: "docs.graph",
      remediation: expect.stringContaining("out"),
    });
    expect(process.exitCode).toBe(1);

    vi.mocked(console.log).mockClear();
    process.exitCode = undefined;
    await cliDocs(["graph", "checkout-spec", "--preset", "everything", "--root", workspace, "--json"]);
    expect(parsedOutput<{ error: { code: string; operation: string; remediation: string } }>().error).toMatchObject({
      code: "unknown-docs-graph-preset",
      operation: "docs.graph",
      remediation: expect.stringContaining("implementation"),
    });
    expect(process.exitCode).toBe(1);

    vi.mocked(console.log).mockClear();
    process.exitCode = undefined;
    await cliDocs(["graph", "checkout-spec", "--filter-axis", "unknown", "--root", workspace, "--json"]);
    expect(parsedOutput<{ error: { code: string; operation: string; remediation: string } }>().error).toMatchObject({
      code: "unknown-docs-graph-filter-axis",
      operation: "docs.graph",
      remediation: expect.stringContaining("--axis selects traversal axes"),
    });
    expect(process.exitCode).toBe(1);
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
    expect(text).toContain("warning: text search is broad");
    expect(text).toContain("[spec] checkout-spec");
    expect(text).toContain("[prd] tasks/checkout-prd");
    expect(text.indexOf("[spec] checkout-spec")).toBeLessThan(text.indexOf("[prd] tasks/checkout-prd"));
  });

  it("reports completed TODO drift candidates as info without failing", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-docs-completed-todo-"));
    await mkdir(join(rootDir, "docs/specs/completed"), { recursive: true });
    await writeFile(join(rootDir, "pnpm-workspace.yaml"), "packages: []\n");
    await writeFile(join(rootDir, "docs/specs/completed/completed-rollout.todo.md"), `---
def:
  id: completed-rollout-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Completed Rollout

## 목적 ^purpose

Track completed rollout work.

## Completed — 완료 기록

- [x] Publish rollout docs.
- [x] Verify lifecycle inventory.
`);

    await cliDocs(["drift", "--root", rootDir, "--json"]);

    const result = parsedOutput<{
      counts: { total: number; error: number; warning: number; info: number };
      issuesBySeverity: {
        error: Array<{ code: string; path: string }>;
        warning: Array<{ code: string; path: string }>;
        info: Array<{ code: string; path: string; metadata: Record<string, unknown> }>;
      };
    }>();

    expect(process.exitCode).toBeUndefined();
    expect(result.counts).toEqual({
      total: 1,
      error: 0,
      warning: 0,
      info: 1,
    });
    expect(result.issuesBySeverity.error).toEqual([]);
    expect(result.issuesBySeverity.warning).toEqual([]);
    expect(result.issuesBySeverity.info).toEqual([
      expect.objectContaining({
        code: "completed-todo-record-candidate",
        path: "docs/specs/completed/completed-rollout.todo.md",
        metadata: expect.objectContaining({
          kind: "todo",
          documentId: "completed-rollout-todo",
          completedCount: 2,
          openCount: 0,
        }),
      }),
    ]);
  });

  it("reports completed PRD markdown drift candidates by PRD scope and excludes archive/session state", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-docs-completed-prd-"));
    await mkdir(join(rootDir, "docs"), { recursive: true });
    await mkdir(join(rootDir, "tasks/archive"), { recursive: true });
    await mkdir(join(rootDir, ".ralph-tui"), { recursive: true });
    await writeFile(join(rootDir, "pnpm-workspace.yaml"), "packages: []\n");
    await writePrdPair(rootDir, "active-prd", "Active PRD");
    await writePrdPair(rootDir, "other-prd", "Other PRD");
    await writePrdPair(rootDir, "archive/archived-prd", "Archived PRD");
    await writeFile(join(rootDir, ".ralph-tui/session-meta.json"), JSON.stringify({
      id: "active-session",
      status: "completed",
      prdPath: "tasks/active-prd.json",
      totalTasks: 1,
      tasksCompleted: 1,
    }, null, 2));

    await cliDocs(["drift", "--root", rootDir, "--json"]);

    const broad = parsedOutput<{
      counts: { error: number; warning: number; info: number };
      issuesBySeverity: {
        info: Array<{ code: string; path: string; metadata: Record<string, unknown> }>;
      };
    }>();
    expect(process.exitCode).toBeUndefined();
    expect(broad.counts).toMatchObject({
      error: 0,
      warning: 0,
      info: 2,
    });
    expect(broad.issuesBySeverity.info.map((issue) => issue.path)).toEqual([
      "tasks/active-prd.md",
      "tasks/other-prd.md",
    ]);
    expect(broad.issuesBySeverity.info).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "tasks/archive/archived-prd.md" }),
        expect.objectContaining({ path: ".ralph-tui/session-meta.json" }),
      ]),
    );

    vi.mocked(console.log).mockClear();
    await cliDocs(["drift", "--root", rootDir, "--prd", "tasks/active-prd.json", "--json"]);

    const scoped = parsedOutput<{
      scope: { prd: string; documents: number };
      counts: { error: number; warning: number; info: number };
      issues: Array<{ code: string; path: string; metadata: Record<string, unknown> }>;
    }>();
    expect(process.exitCode).toBeUndefined();
    expect(scoped.scope.prd).toBe("tasks/active-prd.json");
    expect(scoped.counts).toMatchObject({
      error: 0,
      warning: 0,
      info: 1,
    });
    expect(scoped.issues).toEqual([
      expect.objectContaining({
        code: "completed-prd-record-candidate",
        path: "tasks/active-prd.md",
        metadata: expect.objectContaining({
          kind: "prd",
          pairedPath: "tasks/active-prd.json",
          storyCount: 1,
          passedStoryCount: 1,
        }),
      }),
    ]);
    expect(scoped.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "tasks/other-prd.md" }),
        expect.objectContaining({ path: "tasks/archive/archived-prd.md" }),
        expect.objectContaining({ path: ".ralph-tui/session-meta.json" }),
      ]),
    );
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
    expect(result.counts.total).toBeGreaterThanOrEqual(5);
    expect(result.counts.error).toBeGreaterThanOrEqual(2);
    expect(result.counts.warning).toBeGreaterThanOrEqual(3);
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
    expect(result.issuesBySeverity.warning).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ralph-session-prd-complete-session-running",
        }),
      ]),
    );
  });

  it("includes transient ralph session drift only when requested", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["drift", "--root", workspace, "--include-session", "--json"]);

    const result = parsedOutput<{
      issuesBySeverity: {
        warning: Array<{ code: string; path: string; remediation: string }>;
      };
    }>();
    expect(result.issuesBySeverity.warning).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ralph-session-prd-complete-session-running",
          path: ".ralph-tui/session-meta.json",
          remediation: expect.stringContaining("Stop or archive"),
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
        expect.objectContaining({ code: "prd-markdown-unchecked-after-json-complete" }),
      ]),
    );
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ralph-session-prd-complete-session-running" }),
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
    await mkdir(join(workspace, "tasks/archive"), { recursive: true });
    await writeFile(join(workspace, "tasks/archive/checkout-archive-prd.md"), `[PRD]
# PRD: Archived Checkout PRD

## Overview

Archived checkout context should stay out of active authoring context.

## User Stories

### US-001: Archived work

**Description:** As a maintainer, I want archived work ignored by default.

**Acceptance Criteria:**
- [ ] Archive remains opt-in.
[/PRD]
`);

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
        expect.objectContaining({ stableId: "checkout-spec", reason: "topic-match" }),
      ]),
    );
    expect(result.contextSources.map((source) => source.stableId)).not.toContain(
      "tasks/archive/checkout-archive-prd",
    );
    expect(result.contextSources.map((source) => source.reason)).not.toEqual(
      expect.arrayContaining(["graph:role", "graph:dependency", "graph:source", "graph:evidence"]),
    );
  });

  it("uses bounded graph traversal for exact PRD context targets", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs(["prd", "context", "checkout-spec", "--root", workspace, "--json"]);

    const result = parsedOutput<{
      resolvedTarget: { stableId: string; kind: string };
      contextSources: Array<{
        stableId: string;
        kind: string;
        reason: string;
        ranking?: {
          rank: number;
          score: number;
          strength: string;
          reasons: string[];
        };
      }>;
      relatedSpecs: Array<{ stableId: string }>;
      plans: Array<{ stableId: string }>;
      evidence: Array<{ id: string }>;
    }>();
    expect(result.resolvedTarget).toMatchObject({
      stableId: "checkout-spec",
      kind: "spec",
    });
    expect(result.contextSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec", reason: "target" }),
        expect.objectContaining({ stableId: "checkout-plan", reason: "graph:dependency" }),
        expect.objectContaining({ stableId: "checkout-evidence", reason: "graph:source" }),
      ]),
    );
    const contextSourceIds = result.contextSources.map((source) => source.stableId);
    const contextIndex = (stableId: string) => contextSourceIds.indexOf(stableId);
    expect(contextIndex("checkout-spec")).toBe(0);
    expect(contextIndex("checkout-todo")).toBeGreaterThanOrEqual(0);
    expect(contextIndex("checkout-todo")).toBeLessThan(contextIndex("checkout-evidence"));
    expect(contextIndex("checkout-plan")).toBeLessThan(contextIndex("checkout-evidence"));
    expect(result.contextSources.find((source) => source.stableId === "checkout-spec")?.ranking).toMatchObject({
      rank: 1,
      score: expect.any(Number),
      reasons: expect.arrayContaining([expect.stringContaining("target")]),
    });
    expect(result.contextSources.find((source) => source.stableId === "checkout-plan")?.ranking).toMatchObject({
      score: expect.any(Number),
      reasons: expect.arrayContaining([expect.stringContaining("dependency")]),
    });
    expect(result.contextSources.map((source) => source.reason)).not.toContain("topic-match");
    expect(result.relatedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-spec" }),
      ]),
    );
    expect(result.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "checkout-plan" }),
      ]),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "checkout-evidence" }),
      ]),
    );
  });

  it("ranks actionable PRD TODO context before deferred and parking-lot TODOs", async () => {
    const workspace = await createFixtureWorkspace();
    await writeFile(join(workspace, "docs/specs/checkout/checkout-deferred.todo.md"), `---
def:
  id: checkout-deferred-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
familyId: docs/specs/checkout/checkout
---
# Checkout Deferred Todo

## 목적 ^purpose

Track deferred checkout work.

## Deferred — 조건부 대기

- [ ] Wait for partner API confirmation.
`);
    await writeFile(join(workspace, "docs/specs/checkout/checkout-parking.todo.md"), `---
def:
  id: checkout-parking-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
familyId: docs/specs/checkout/checkout
---
# Checkout Parking Todo

## 목적 ^purpose

Track optional checkout ideas.

## Parking Lot — 후보 보관

- [ ] Evaluate optional checkout dashboard.
`);

    await cliDocs([
      "prd",
      "context",
      "checkout-spec",
      "--kind",
      "todo",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<{
      contextSources: Array<{
        stableId: string;
        reason: string;
        ranking?: {
          score: number;
          reasons: string[];
        };
      }>;
      openTodos: Array<{ documentId: string; text: string }>;
    }>();
    const contextSourceIds = result.contextSources.map((source) => source.stableId);
    const actionableIndex = contextSourceIds.indexOf("checkout-todo");
    const deferredIndex = contextSourceIds.indexOf("checkout-deferred-todo");
    const parkingIndex = contextSourceIds.indexOf("checkout-parking-todo");

    expect(actionableIndex).toBeGreaterThanOrEqual(0);
    expect(deferredIndex).toBeGreaterThanOrEqual(0);
    expect(parkingIndex).toBeGreaterThanOrEqual(0);
    expect(actionableIndex).toBeLessThan(deferredIndex);
    expect(deferredIndex).toBeLessThan(parkingIndex);
    expect(result.contextSources.find((source) => source.stableId === "checkout-todo")?.ranking?.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("follow-up category actionable")]),
    );
    expect(result.contextSources.find((source) => source.stableId === "checkout-deferred-todo")?.ranking?.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("follow-up category deferred")]),
    );
    expect(result.contextSources.find((source) => source.stableId === "checkout-parking-todo")?.ranking?.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("follow-up category parking-lot")]),
    );
    expect(result.openTodos.map((todo) => todo.documentId)).toEqual([
      "checkout-todo",
      "checkout-todo",
      "checkout-deferred-todo",
      "checkout-parking-todo",
    ]);
  });

  it("applies graph filters to exact PRD context related sources", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "prd",
      "context",
      "checkout-spec",
      "--kind",
      "plan",
      "--filter-axis",
      "dependency",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<{
      resolvedTarget: { stableId: string; kind: string };
      contextSources: Array<{ stableId: string; kind: string; reason: string }>;
      relatedSpecs: Array<{ stableId: string }>;
      plans: Array<{ stableId: string }>;
      evidence: Array<{ id: string }>;
    }>();
    expect(result.resolvedTarget).toMatchObject({
      stableId: "checkout-spec",
      kind: "spec",
    });
    expect(result.contextSources).toEqual([
      expect.objectContaining({ stableId: "checkout-plan", kind: "plan", reason: "graph:dependency" }),
    ]);
    expect(result.relatedSpecs).toEqual([]);
    expect(result.plans).toEqual([
      expect.objectContaining({ stableId: "checkout-plan" }),
    ]);
    expect(result.evidence).toEqual([]);
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

    vi.mocked(console.log).mockClear();
    const textOutputPath = join(workspace, "tasks/generated-checkout-prd-text.md");
    await cliDocs([
      "prd",
      "scaffold",
      "checkout",
      "--root",
      workspace,
      "--output",
      "tasks/generated-checkout-prd-text.md",
    ]);

    await expect(readFile(textOutputPath, "utf8")).resolves.toContain("[PRD]");
    expect(output().split("\n")[0]).toBe("docs prd scaffold: wrote tasks/generated-checkout-prd-text.md");
  });

  it("reports absolute PRD scaffold output paths outside the repository", async () => {
    const workspace = await createFixtureWorkspace();
    const externalDir = await mkdtemp(join(tmpdir(), "qa-sdk-docs-cli-output-"));
    const externalPath = join(externalDir, "generated-external-prd.md");
    const expectedExternalPath = externalPath.replaceAll("\\", "/");

    try {
      await cliDocs([
        "prd",
        "scaffold",
        "checkout",
        "--root",
        workspace,
        "--output",
        externalPath,
        "--json",
      ]);

      const result = parsedOutput<{
        output: string;
        bytes: number;
      }>();
      expect(result.output).toBe(expectedExternalPath);
      expect(result.bytes).toBeGreaterThan(0);
      await expect(readFile(externalPath, "utf8")).resolves.toContain("[PRD]");

      vi.mocked(console.log).mockClear();
      await cliDocs([
        "prd",
        "scaffold",
        "checkout",
        "--root",
        workspace,
        "--output",
        externalPath,
      ]);

      expect(output().split("\n")[0]).toBe(`docs prd scaffold: wrote ${expectedExternalPath}`);
      await expect(readFile(externalPath, "utf8")).resolves.toContain("[PRD]");
    } finally {
      await rm(externalDir, { recursive: true, force: true });
    }
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
    await writeFile(join(workspace, "docs/specs/checkout/checkout-source-only.spec.md"), `---
def:
  id: checkout-source-only
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: approved
source: packages/checkout/src/completion.ts
---
# Checkout Source Only

## 목적 ^purpose

Provide source-only completion proof for PRD sync reason classification.
`);
    const prdJson = JSON.parse(await readFile(prdPath, "utf8")) as {
      userStories: Array<{ completionNotes?: string }>;
    };
    prdJson.userStories[0]!.completionNotes = "Completed by agent. See packages/checkout/src/completion.ts, E-CHECKOUT-COMPLETION, and E-CHECKOUT-DRIFT.";
    await writeFile(prdPath, JSON.stringify(prdJson, null, 2));
    await writeFile(join(workspace, "artifacts/programming-artifacts.json"), JSON.stringify({
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
        {
          artifactId: "E-CHECKOUT-COMPLETION",
          kind: "activation-evidence",
          artifactRef: "artifacts/checkout-completion.json",
          outputPath: "artifacts/checkout-completion.json",
          ownerDefinitionId: "checkout-source-only",
          sourceRefs: ["packages/checkout/src/completion.ts"],
          verificationRefs: [],
          relations: [
            {
              kind: "verifies",
              fromRef: "E-CHECKOUT-COMPLETION",
              toRef: "checkout-source-only",
            },
          ],
          metadata: {
            packId: "checkout-pack",
          },
        },
      ],
    }, null, 2));
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
      affectedDocs: Array<{ kind: string; stableId: string; path: string; reason: string }>;
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
      sessionDrift: 0,
    });
    expect(result.counts.affectedDocs).toBeGreaterThanOrEqual(5);
    expect(result.completedStories).toEqual([
      expect.objectContaining({ id: "US-001", title: "Complete checkout docs" }),
    ]);
    expect(result.affectedDocs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "spec", stableId: "checkout-spec", reason: "trace" }),
        expect.objectContaining({ kind: "todo", stableId: "checkout-todo", reason: "trace" }),
        expect.objectContaining({ kind: "plan", stableId: "checkout-plan", reason: "trace" }),
      ]),
    );
    expect(result.affectedDocs).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "ralph-session", path: ".ralph-tui/session-meta.json" }),
      ]),
    );
    expect(result.affectedDocs.map((document) => document.reason)).not.toEqual(
      expect.arrayContaining(["topic-match", "definition-family", "prd-family"]),
    );
    expect([...new Set(result.affectedDocs.map((document) => document.reason))]).toEqual(
      expect.arrayContaining(["target", "trace", "source", "evidence"]),
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
    expect(result.sessionDrift).toEqual([]);
    await expect(readFile(specPath, "utf8")).resolves.toBe(beforeSpec);
    await expect(readFile(todoPath, "utf8")).resolves.toBe(beforeTodo);
    await expect(readFile(planPath, "utf8")).resolves.toBe(beforePlan);
    await expect(readFile(prdPath, "utf8")).resolves.toBe(beforePrd);
  });

  it("excludes archive PRD documents from completion sync affected docs by default", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "tasks/archive"), { recursive: true });
    await writeFile(join(workspace, "tasks/archive/checkout-archive-prd.md"), `[PRD]
# PRD: Archived Checkout PRD

## Overview

Archived checkout work.

## User Stories

### US-001: Archived checkout story

**Description:** Archived story.

**Acceptance Criteria:**
- [x] Archived criterion.
[/PRD]
`);
    await writeFile(join(workspace, "tasks/archive/checkout-archive-prd.json"), JSON.stringify({
      name: "Archived Checkout PRD",
      branchName: "ralph/checkout-archive",
      description: "Archived checkout work.",
      userStories: [
        {
          id: "US-001",
          title: "Archived checkout story",
          description: "Archived story.",
          acceptanceCriteria: ["Archived criterion."],
          priority: 1,
          passes: true,
          dependsOn: [],
        },
      ],
    }, null, 2));

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--json",
    ]);

    const result = parsedOutput<{
      affectedDocs: Array<{ kind: string; path: string; reason: string }>;
    }>();
    expect(result.affectedDocs.map((document) => document.path)).not.toEqual(
      expect.arrayContaining([
        "tasks/archive/checkout-archive-prd.md",
        "tasks/archive/checkout-archive-prd.json",
      ]),
    );
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

  it("supports evidence-only completion review mode", async () => {
    const workspace = await createFixtureWorkspace();
    await addSourceOnlyCompletionCandidate(workspace);

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--evidence-only",
      "--json",
    ]);

    const result = parsedOutput<{
      options: { evidenceOnly: boolean; strict: boolean };
      counts: { blockedPromotions: number; strictFailures: number };
      specUpdateCandidates: Array<{
        documentId: string;
        promotionState: string;
        support: { source: number; test: number; evidence: number; qualifying: number; ignored: number };
        blockedReasons: string[];
        score: { total: number; strength: string };
      }>;
    }>();

    expect(result.options).toMatchObject({
      evidenceOnly: true,
      strict: false,
    });
    expect(result.counts.blockedPromotions).toBeGreaterThanOrEqual(1);
    expect(result.specUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "checkout-spec",
          promotionState: "eligible",
          support: expect.objectContaining({
            evidence: expect.any(Number),
            qualifying: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          documentId: "checkout-source-only",
          promotionState: "blocked",
          support: expect.objectContaining({
            source: 2,
            evidence: 0,
            qualifying: 0,
            ignored: 2,
          }),
          blockedReasons: expect.arrayContaining([
            expect.stringContaining("--evidence-only"),
          ]),
          score: expect.objectContaining({
            total: expect.any(Number),
          }),
        }),
      ]),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("fails strict completion sync for low-confidence source-only candidates", async () => {
    const workspace = await createFixtureWorkspace();
    await addSourceOnlyCompletionCandidate(workspace);

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--json",
    ]);

    const defaultResult = parsedOutput<{
      specUpdateCandidates: Array<{ documentId: string; promotionState: string; score: { total: number } }>;
    }>();
    expect(defaultResult.specUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "checkout-source-only",
          promotionState: "eligible",
        }),
      ]),
    );
    expect(process.exitCode).toBeUndefined();

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--strict",
      "--json",
    ]);

    const strictResult = parsedOutput<{
      options: { strict: boolean; evidenceOnly: boolean };
      counts: { strictFailures: number; blockedPromotions: number };
      specUpdateCandidates: Array<{
        documentId: string;
        promotionState: string;
        blockedReasons: string[];
        score: { total: number; strength: string };
      }>;
    }>();
    expect(strictResult.options).toMatchObject({
      strict: true,
      evidenceOnly: false,
    });
    expect(strictResult.counts.strictFailures).toBeGreaterThanOrEqual(1);
    expect(strictResult.counts.blockedPromotions).toBeGreaterThanOrEqual(1);
    expect(strictResult.specUpdateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "checkout-source-only",
          promotionState: "blocked",
          blockedReasons: expect.arrayContaining([
            expect.stringContaining("strict mode requires completion score"),
          ]),
          score: expect.objectContaining({
            strength: "weak",
          }),
        }),
      ]),
    );
    expect(process.exitCode).toBe(1);
  });

  it("includes ralph session state in completion sync only when requested", async () => {
    const workspace = await createFixtureWorkspace();

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--include-session",
      "--json",
    ]);

    const result = parsedOutput<{
      counts: { sessionDrift: number };
      affectedDocs: Array<{ kind: string; path: string }>;
      sessionDrift: Array<{ code: string }>;
    }>();
    expect(result.counts.sessionDrift).toBe(1);
    expect(result.affectedDocs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "ralph-session", path: ".ralph-tui/session-meta.json" }),
      ]),
    );
    expect(result.sessionDrift).toEqual([
      expect.objectContaining({ code: "ralph-session-prd-complete-session-running" }),
    ]);
  });

  it("limits PRD completion sync to the PRD family and directly linked docs with --family-only", async () => {
    const workspace = await createFixtureWorkspace();
    await mkdir(join(workspace, "docs/specs/unrelated"), { recursive: true });
    await writeFile(join(workspace, "docs/specs/unrelated/unrelated.todo.md"), `---
def:
  id: unrelated-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: draft
---
# Unrelated Todo

## 목적 ^purpose

Mentions checkout without being linked to the active PRD family.

- [ ] This checkout-looking item must stay out of family-only sync.
`);

    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--family-only",
      "--json",
    ]);

    const result = parsedOutput<{
      affectedDocs: Array<{ kind: string; stableId: string; path: string; reason: string; reasons: string[] }>;
      counts: { sessionDrift: number };
      openTodoCandidates: Array<{ documentId: string; path: string }>;
    }>();
    expect(result.affectedDocs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "prd", stableId: "tasks/checkout-prd", reason: "role" }),
        expect.objectContaining({ kind: "ralph-prd-json", stableId: "tasks/checkout-prd", reason: "target" }),
        expect.objectContaining({ kind: "spec", stableId: "checkout-spec", reasons: expect.arrayContaining(["trace"]) }),
        expect.objectContaining({ kind: "todo", stableId: "checkout-todo", reasons: expect.arrayContaining(["trace"]) }),
        expect.objectContaining({ kind: "plan", stableId: "checkout-plan", reasons: expect.arrayContaining(["trace"]) }),
        expect.objectContaining({ kind: "rule", stableId: "checkout-rule", reason: "role" }),
        expect.objectContaining({ kind: "spec", stableId: "checkout-child", reason: "composition" }),
      ]),
    );
    expect(result.affectedDocs).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "unrelated-todo" }),
        expect.objectContaining({ kind: "ralph-session" }),
      ]),
    );
    expect(result.openTodoCandidates.map((candidate) => candidate.path)).not.toContain("tasks/checkout-prd.md");
    expect(result.openTodoCandidates.map((candidate) => candidate.documentId)).not.toContain("unrelated-todo");
    expect(result.counts.sessionDrift).toBe(0);

    vi.mocked(console.log).mockClear();
    await cliDocs([
      "prd",
      "sync-completion",
      "--prd",
      "tasks/checkout-prd.json",
      "--root",
      workspace,
      "--family-only",
      "--include-session",
      "--json",
    ]);
    const withSession = parsedOutput<{
      affectedDocs: Array<{ kind: string; path: string; reason: string; reasons: string[] }>;
      counts: { sessionDrift: number };
    }>();
    expect(withSession.affectedDocs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ralph-session",
          path: ".ralph-tui/session-meta.json",
          reason: "transient",
        }),
      ]),
    );
    expect(withSession.counts.sessionDrift).toBe(1);
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
    expect(result.changeSets[0]!.after.links).toEqual(
      expect.arrayContaining([
        { target: "checkout-child", type: "contains" },
        { target: "checkout-refinement", type: "refines" },
        { target: "US-001", type: "traces_to" },
        { target: "checkout-todo", type: "contains" },
      ]),
    );
    expect(result.changeSets[0]!.after.links).not.toEqual(
      expect.arrayContaining([
        { target: "checkout-plan", type: "depends_on" },
      ]),
    );
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
