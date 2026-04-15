import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cliDocs } from "./docs.js";

describe("docs commands", () => {
  let rootDir = "";

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    rootDir = "";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  async function createFixtureWorkspace(): Promise<string> {
    rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-docs-cli-"));
    await mkdir(join(rootDir, "docs/specs/checkout"), { recursive: true });
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
- [x] JSON output exists.

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
          notes: "",
          dependsOn: [],
          completionNotes: "Completed by agent",
        },
      ],
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

  function output(): string {
    return vi.mocked(console.log).mock.calls.map((call) => String(call[0])).join("\n");
  }

  function parsedOutput<T>(): T {
    return JSON.parse(output()) as T;
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
      counts: { tasks: number; diagnostics: number };
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
    expect(result.counts.tasks).toBeGreaterThan(0);
    expect(result.counts.diagnostics).toBeGreaterThan(0);
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
});
