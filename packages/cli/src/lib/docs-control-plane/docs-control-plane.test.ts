import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createArtifactEvidenceAdapter,
  createDefinitionMarkdownAdapter,
  createPrdMarkdownAdapter,
  createRalphPrdJsonAdapter,
  createRalphSessionAdapter,
  declareDocumentAdapterCapabilities,
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
  type ArtifactEvidenceCollectionQuery,
} from "./index.js";
import {
  buildActivationEvidenceRegistryRecord,
  type ActivationEvidenceRegistryActivationResult,
} from "../activation-evidence-registry.js";

describe("docs-control-plane envelope normalization", () => {
  it("normalizes identifiers, paths, collection defaults, and raw source pointers", () => {
    const metadata = { lifecycle: "approved" };

    const envelope = normalizeDocumentEnvelope({
      adapterId: " definition-docs ",
      kind: " spec ",
      stableId: " definition-addressing ",
      familyId: " definition-catalog ",
      path: "docs\\specs\\definition-catalog\\definition-addressing.spec.md",
      metadata,
      links: [
        {
          type: " contains ",
          targetId: " definition-taxonomy ",
          sourceId: " definition-addressing ",
        },
      ],
      sources: [
        {
          id: " frontmatter ",
          path: "docs\\specs\\definition-catalog\\definition-addressing.spec.md",
          rawSource: {
            path: "docs\\specs\\definition-catalog\\definition-addressing.spec.md",
            pointer: " /def ",
          },
        },
      ],
      sections: [
        {
          id: " purpose ",
          title: " Purpose ",
          anchor: " ^purpose ",
          content: "  keep source whitespace  ",
        },
      ],
      tasks: [
        {
          id: " US-001 ",
          title: " Define docs control-plane boundary ",
          status: " open ",
          evidenceIds: [" evidence-1 ", " "],
        },
      ],
      evidence: [
        {
          id: " evidence-1 ",
          kind: " acceptance ",
          summary: " module boundary exists ",
          rawSource: {
            path: ".ralph-tui\\progress.md",
          },
        },
      ],
      diagnostics: [
        {
          code: " missing-section ",
          severity: " warning ",
          message: " section missing ",
        },
      ],
      rawSource: {
        path: "docs\\specs\\definition-catalog\\definition-addressing.spec.md",
        sourceSchema: " definition-frontmatter ",
      },
    });

    expect(envelope).toMatchObject({
      adapterId: "definition-docs",
      kind: "spec",
      stableId: "definition-addressing",
      familyId: "definition-catalog",
      path: "docs/specs/definition-catalog/definition-addressing.spec.md",
      rawSource: {
        path: "docs/specs/definition-catalog/definition-addressing.spec.md",
        sourceSchema: "definition-frontmatter",
      },
    });
    expect(envelope.metadata).toEqual(metadata);
    expect(envelope.metadata).not.toBe(metadata);
    expect(envelope.links).toEqual([
      {
        type: "contains",
        sourceId: "definition-addressing",
        targetId: "definition-taxonomy",
        metadata: {},
      },
    ]);
    expect(envelope.sources[0]).toMatchObject({
      id: "frontmatter",
      path: "docs/specs/definition-catalog/definition-addressing.spec.md",
      rawSource: {
        path: "docs/specs/definition-catalog/definition-addressing.spec.md",
        pointer: "/def",
      },
      metadata: {},
    });
    expect(envelope.sections[0]).toMatchObject({
      id: "purpose",
      title: "Purpose",
      anchor: "^purpose",
      content: "  keep source whitespace  ",
      metadata: {},
    });
    expect(envelope.tasks[0]).toMatchObject({
      id: "US-001",
      title: "Define docs control-plane boundary",
      status: "open",
      evidenceIds: ["evidence-1"],
      metadata: {},
    });
    expect(envelope.evidence[0]).toMatchObject({
      id: "evidence-1",
      kind: "acceptance",
      summary: "module boundary exists",
      rawSource: {
        path: ".ralph-tui/progress.md",
      },
      metadata: {},
    });
    expect(envelope.diagnostics[0]).toEqual({
      code: "missing-section",
      severity: "warning",
      message: "section missing",
      metadata: {},
    });
  });

  it("defaults optional collections to empty arrays and rejects missing stable identity", () => {
    const envelope = normalizeDocumentEnvelope({
      adapterId: "prd",
      kind: "prd",
      stableId: "us-001",
      path: "docs/prd.md",
      rawSource: { path: "docs/prd.md" },
    });

    expect(envelope.links).toEqual([]);
    expect(envelope.sources).toEqual([]);
    expect(envelope.sections).toEqual([]);
    expect(envelope.tasks).toEqual([]);
    expect(envelope.evidence).toEqual([]);
    expect(envelope.diagnostics).toEqual([]);

    expect(() =>
      normalizeDocumentEnvelope({
        adapterId: "prd",
        kind: "prd",
        stableId: " ",
        path: "docs/prd.md",
        rawSource: { path: "docs/prd.md" },
      }),
    ).toThrow("stableId");
  });
});

describe("docs-control-plane adapter capability declarations", () => {
  it("declares adapters as read-only unless write or transform is explicitly enabled", async () => {
    const adapter = defineDocumentAdapter({
      id: " definition-docs ",
      listDocuments: async () => [],
      getDocument: async () => null,
    });

    expect(adapter.id).toBe("definition-docs");
    expect(adapter.capabilities).toEqual({
      write: false,
      transform: false,
    });
    await expect(adapter.listDocuments()).resolves.toEqual([]);
    await expect(adapter.getDocument("missing")).resolves.toBeNull();
  });

  it("preserves explicit write and transform capability declarations", () => {
    expect(
      declareDocumentAdapterCapabilities({
        write: true,
        transform: true,
      }),
    ).toEqual({
      write: true,
      transform: true,
    });

    const adapter = defineDocumentAdapter({
      id: "ralph-json",
      capabilities: {
        write: true,
        transform: false,
      },
      listDocuments: async () => [],
      getDocument: async () => null,
    });

    expect(adapter.capabilities).toEqual({
      write: true,
      transform: false,
    });
  });
});

describe("artifact-evidence adapter", () => {
  async function withTempArtifactRegistry(
    callback: (rootDir: string) => Promise<void>,
  ): Promise<void> {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-artifact-evidence-"));
    try {
      await mkdir(join(rootDir, "artifacts/activation"), { recursive: true });
      await callback(rootDir);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  }

  function activationResult(
    overrides: Partial<ActivationEvidenceRegistryActivationResult> = {},
  ): ActivationEvidenceRegistryActivationResult {
    return {
      status: "succeeded",
      packId: "programming-artifact-ontology",
      ontologyId: "workspace-programming-artifacts",
      namespaceSummary: {
        namespace: "qa-sdk",
      },
      allocationSummaries: [
        {
          activationStatus: "active",
          syncStatus: "synced",
        },
      ],
      smokeCheckSummary: {
        allocationCount: 1,
        passedAllocationCount: 1,
        failedAllocationCount: 0,
        checkCount: 2,
        passedCheckCount: 2,
        failedCheckCount: 0,
      },
      warnings: [],
      errors: [],
      ...overrides,
    };
  }

  it("collects activation-evidence registry records as document evidence", async () => {
    await withTempArtifactRegistry(async (rootDir) => {
      const outputPath = join(rootDir, "artifacts/activation/programming-artifact-ontology.json");
      const registryPath = join(rootDir, "artifacts/programming-artifacts.json");
      const record = buildActivationEvidenceRegistryRecord({
        activationResult: activationResult(),
        resolvedOutputPath: outputPath,
        commandContext: {
          packId: "programming-artifact-ontology",
          knownPackImportRef: "operational-ontology/programming-artifacts",
        },
        generatedAt: "2026-04-15T00:00:00.000Z",
      });
      await writeFile(
        registryPath,
        JSON.stringify({ artifacts: [record], registryVersion: 1 }, null, 2),
      );

      const adapter = createArtifactEvidenceAdapter({
        rootDir,
        registryPaths: ["artifacts/programming-artifacts.json"],
      });
      const [doc] = await adapter.listDocuments();

      expect(doc).toMatchObject({
        adapterId: "artifact-evidence",
        kind: "activation-evidence",
        stableId:
          "activation-evidence-programming-artifact-ontology-workspace-programming-artifacts",
        familyId: "operational-ontology-registry-activation-cli",
        rawSource: {
          path: "artifacts/programming-artifacts.json",
          pointer: "/artifacts/0",
          sourceSchema: "programming-artifact-registry",
        },
      });
      expect(doc!.metadata).toMatchObject({
        artifactId:
          "activation-evidence-programming-artifact-ontology-workspace-programming-artifacts",
        artifactKind: "activation-evidence",
        artifactRef: outputPath,
        outputPath,
        producedByRef:
          "qa-sdk ontology registry activate-pack programming-artifact-ontology",
        ownerDefinitionId: "operational-ontology-registry-activation-cli",
        registryPath: "artifacts/programming-artifacts.json",
        packId: "programming-artifact-ontology",
        ontologyId: "workspace-programming-artifacts",
      });
      expect(doc!.metadata.derivedFromRefs).toEqual([
        "programming-artifact-ontology",
        "operational-ontology/programming-artifacts",
      ]);
      expect(doc!.metadata.verifiesRefs).toEqual([
        "programming-artifact-ontology",
        "workspace-programming-artifacts",
        "operational-ontology-registry-allocation",
      ]);
      expect(doc!.metadata.materializesOutputRefs).toEqual([
        outputPath,
        "activation-result:programming-artifact-ontology:workspace-programming-artifacts",
      ]);
      expect(doc!.metadata.artifactMetadata).toMatchObject({
        status: "succeeded",
        packId: "programming-artifact-ontology",
      });
      expect(doc!.evidence).toEqual([
        expect.objectContaining({
          id: record.artifactId,
          kind: "activation-evidence",
          rawSource: expect.objectContaining({
            path: "artifacts/programming-artifacts.json",
            pointer: "/artifacts/0",
          }),
        }),
      ]);
      expect(doc!.links.map((link) => link.type)).toEqual(
        expect.arrayContaining([
          "produced_by",
          "derived_from",
          "verifies",
          "owned_by_definition",
          "materializes_output",
        ]),
      );
      expect(doc!.sources.map((source) => source.metadata.sourceKind)).toEqual([
        "artifact_ref",
        "output_path",
      ]);
    });
  });

  it("supports artifact evidence filters for document, ref, path, pack, and kind", async () => {
    await withTempArtifactRegistry(async (rootDir) => {
      const outputPath = join(rootDir, "artifacts/activation/programming-artifact-ontology.json");
      const registryPath = join(rootDir, "artifacts/programming-artifacts.json");
      const record = buildActivationEvidenceRegistryRecord({
        activationResult: activationResult(),
        resolvedOutputPath: outputPath,
        commandContext: {
          packId: "programming-artifact-ontology",
          knownPackImportRef: "operational-ontology/programming-artifacts",
        },
        generatedAt: "2026-04-15T00:00:00.000Z",
      });
      await writeFile(registryPath, JSON.stringify({ artifacts: [record] }, null, 2));

      const adapter = createArtifactEvidenceAdapter({
        rootDir,
        registryPaths: ["artifacts/programming-artifacts.json"],
      });
      const filters: ArtifactEvidenceCollectionQuery[] = [
        { documentId: "operational-ontology-registry-activation-cli" },
        { artifactRef: outputPath },
        { outputPath },
        { packId: "programming-artifact-ontology" },
        { kind: "activation-evidence" },
        { artifactKind: "activation-evidence" },
      ];

      for (const filter of filters) {
        await expect(adapter.listDocuments(filter)).resolves.toHaveLength(1);
      }
      await expect(
        adapter.listDocuments({ documentId: "unrelated-definition" } as ArtifactEvidenceCollectionQuery),
      ).resolves.toHaveLength(0);
    });
  });

  it("reads array-form registries without requiring an artifacts envelope", async () => {
    await withTempArtifactRegistry(async (rootDir) => {
      await writeFile(join(rootDir, "registry-array.json"), JSON.stringify([
        {
          artifactId: "build-cli",
          kind: "build",
          artifactRef: "packages/cli/dist/index.js",
          outputPath: "packages/cli/dist/index.js",
          producedByRef: "pnpm --filter @qa-sdk/cli build",
          sourceRefs: ["packages/cli/src/index.ts"],
          verificationRefs: ["packages/cli/src/index.test.ts"],
          metadata: {
            packId: "cli-build",
          },
        },
      ], null, 2));

      const adapter = createArtifactEvidenceAdapter({
        rootDir,
        registryPaths: ["registry-array.json"],
      });
      const [doc] = await adapter.listDocuments({ kind: "build" });

      expect(doc).toMatchObject({
        kind: "build",
        stableId: "build-cli",
        path: "packages/cli/dist/index.js",
        rawSource: {
          path: "registry-array.json",
          pointer: "/0",
        },
      });
      expect(doc!.metadata.sourceRefs).toEqual(["packages/cli/src/index.ts"]);
      expect(doc!.metadata.verificationRefs).toEqual([
        "packages/cli/src/index.test.ts",
      ]);
      expect(doc!.sources.map((source) => source.id)).toEqual([
        "artifact-ref",
        "output-path",
        "source-ref:1",
        "verification-ref:1",
      ]);
    });
  });

  it("does not surface missing registry warnings unless explicitly requested", async () => {
    await withTempArtifactRegistry(async (rootDir) => {
      const silentAdapter = createArtifactEvidenceAdapter({ rootDir });
      await expect(silentAdapter.listDocuments()).resolves.toEqual([]);

      const warningAdapter = createArtifactEvidenceAdapter({
        rootDir,
        registryPaths: ["artifacts/programming-artifacts.json"],
        warnOnMissing: true,
      });
      const [doc] = await warningAdapter.listDocuments();

      expect(doc).toMatchObject({
        kind: "artifact-evidence-source",
        diagnostics: [
          expect.objectContaining({
            code: "artifact-evidence-source-missing",
            severity: "warning",
          }),
        ],
      });
    });
  });
});

describe("definition-markdown adapter", () => {
  async function withTempDocs(
    callback: (rootDir: string) => Promise<void>,
  ): Promise<void> {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-definition-markdown-"));
    try {
      await mkdir(join(rootDir, "docs/specs/checkout"), { recursive: true });
      await callback(rootDir);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  }

  it("collects definition frontmatter, sources, sections, links, and source path", async () => {
    await withTempDocs(async (rootDir) => {
      await writeFile(join(rootDir, "docs/specs/checkout/checkout-flow.spec.md"), `---
def:
  id: checkout-flow
  type: knowledge
  knowledge_kind: guide
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  svc: checkout-service
  tags: [testing, generated]
  links:
    - target: checkout-step
      type: contains
source: packages/checkout/src/flow.ts:CheckoutFlow
sources:
  - packages/checkout/src/steps.ts
---
# Checkout Flow

## 목적 ^purpose

Coordinate checkout decisions.

## 구성 ^overview

- Entry validates the cart.
- Step records payment handoff.
`);

      await writeFile(join(rootDir, "docs/specs/checkout/checkout-step.spec.md"), `---
def:
  id: checkout-step
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
---
# Checkout Step

## 목적 ^purpose

Define one checkout step.
`);

      const adapter = createDefinitionMarkdownAdapter({ rootDir });
      const docs = await adapter.listDocuments();
      const doc = docs.find((item) => item.metadata.defId === "checkout-flow");

      expect(doc).toBeDefined();
      expect(doc).toMatchObject({
        adapterId: "definition-markdown",
        kind: "spec",
        stableId: "checkout-flow",
        familyId: "docs/specs/checkout/checkout-flow",
        path: "docs/specs/checkout/checkout-flow.spec.md",
        rawSource: {
          path: "docs/specs/checkout/checkout-flow.spec.md",
          sourceSchema: "definition-frontmatter",
        },
      });
      expect(doc!.metadata).toMatchObject({
        defId: "checkout-flow",
        title: "Checkout Flow",
        type: "knowledge",
        knowledgeKind: "guide",
        level: "module",
        scope: "flow",
        aspect: "process_flow",
        depth: "overview",
        lifecycle: "approved",
        layer: "domain",
        tags: ["testing", "generated"],
        svc: "checkout-service",
        sourcePath: "docs/specs/checkout/checkout-flow.spec.md",
        purpose: "Coordinate checkout decisions.",
      });
      expect(doc!.metadata.overview).toContain("Entry validates the cart");
      expect(doc!.links).toEqual([
        {
          sourceId: "checkout-flow",
          targetId: "checkout-step",
          type: "contains",
          metadata: {},
        },
      ]);
      expect(doc!.sources).toHaveLength(2);
      expect(doc!.sources[0]).toMatchObject({
        id: "source:1",
        path: "packages/checkout/src/flow.ts",
        label: "CheckoutFlow",
        metadata: {
          value: "packages/checkout/src/flow.ts:CheckoutFlow",
          sourceKind: "doc_frontmatter",
          symbol: "CheckoutFlow",
        },
      });
      expect(doc!.sources[1]).toMatchObject({
        id: "source:2",
        path: "packages/checkout/src/steps.ts",
      });
      expect(doc!.sections.map((section) => section.id)).toEqual(["purpose", "overview"]);
      expect(doc!.sections[0].content).toBe("Coordinate checkout decisions.");
      expect(doc!.sections[1].content).toContain("Step records payment handoff.");
    });
  });

  it("groups spec, todo, and plan markdown by basename family convention", async () => {
    await withTempDocs(async (rootDir) => {
      await writeFile(join(rootDir, "docs/specs/checkout/checkout.spec.md"), `---
def:
  id: checkout-spec
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
---
# Checkout Spec

## 목적 ^purpose

Spec member.
`);

      await writeFile(join(rootDir, "docs/specs/checkout/checkout.todo.md"), `---
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

Todo member.
`);

      await writeFile(join(rootDir, "docs/specs/checkout/checkout.plan.md"), `---
def:
  id: checkout-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: review
---
# Checkout Plan

## 목적 ^purpose

Plan member.
`);

      const adapter = createDefinitionMarkdownAdapter({ rootDir });
      const family = await adapter.listDocuments({
        familyId: "docs/specs/checkout/checkout",
      });

      expect(family.map((doc) => doc.kind)).toEqual(["spec", "plan", "todo"]);
      expect(family.map((doc) => doc.metadata.defId)).toEqual([
        "checkout-spec",
        "checkout-plan",
        "checkout-todo",
      ]);
      expect(new Set(family.map((doc) => doc.familyId))).toEqual(
        new Set(["docs/specs/checkout/checkout"]),
      );
    });
  });

  it("surfaces level diagnostics from definition-catalog validation", async () => {
    await withTempDocs(async (rootDir) => {
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

Groups checkout docs without children.
`);

      const adapter = createDefinitionMarkdownAdapter({ rootDir });
      const doc = await adapter.getDocument("checkout-group");

      expect(doc).toBeDefined();
      expect(doc!.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "level-violation",
            severity: "error",
            message: expect.stringContaining("level=group"),
          }),
        ]),
      );
    });
  });
});

describe("PRD and ralph compatibility adapters", () => {
  async function withTempWorkflow(
    callback: (rootDir: string) => Promise<void>,
  ): Promise<void> {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-prd-adapters-"));
    try {
      await mkdir(join(rootDir, "tasks"), { recursive: true });
      await mkdir(join(rootDir, ".ralph-tui"), { recursive: true });
      await callback(rootDir);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  }

  it("collects PRD markdown sections and story acceptance criteria from a [PRD] block", async () => {
    await withTempWorkflow(async (rootDir) => {
      await writeFile(join(rootDir, "tasks/sample-prd.md"), `[PRD]
# PRD: Sample Workflow

## Overview

Coordinate documentation adapters.

## Goals

- Preserve source documents.
- Expose workflow state.

## Quality Gates

- \`pnpm --filter @qa-sdk/cli test -- docs\` passes.
- \`pnpm --filter @qa-sdk/cli typecheck\` passes.

## User Stories

### US-001: Parse PRD Markdown

**Description:** As a maintainer, I want PRD markdown available through the control plane.

**Acceptance Criteria:**
- [x] Overview is collected.
- [ ] Open criteria remain visible.

### US-002: Keep Ralph JSON Separate

**Description:** As a maintainer, I want ralph execution JSON to remain an adapter.

**Depends on:** US-001

**Acceptance Criteria:**
- [ ] JSON is not the core document model.

## Functional Requirements

- FR-1: PRD blocks are read without mutating files.

## Non-Goals

- Running ralph-tui.

## Open Questions

- Which CLI command should expose drift later?
[/PRD]
`);

      const adapter = createPrdMarkdownAdapter({
        rootDir,
        paths: ["tasks/sample-prd.md"],
      });
      const [doc] = await adapter.listDocuments();

      expect(doc).toMatchObject({
        adapterId: "prd-markdown",
        kind: "prd",
        stableId: "tasks/sample-prd",
        familyId: "tasks/sample-prd",
        path: "tasks/sample-prd.md",
      });
      expect(doc!.metadata).toMatchObject({
        title: "Sample Workflow",
        overview: "Coordinate documentation adapters.",
        goals: ["Preserve source documents.", "Expose workflow state."],
        qualityGates: [
          "`pnpm --filter @qa-sdk/cli test -- docs` passes.",
          "`pnpm --filter @qa-sdk/cli typecheck` passes.",
        ],
        functionalRequirements: ["FR-1: PRD blocks are read without mutating files."],
        nonGoals: ["Running ralph-tui."],
        openQuestions: ["Which CLI command should expose drift later?"],
      });
      expect(doc!.sections.map((section) => section.id)).toEqual([
        "overview",
        "goals",
        "quality-gates",
        "user-stories",
        "functional-requirements",
        "non-goals",
        "open-questions",
      ]);
      expect(doc!.tasks).toHaveLength(2);
      expect(doc!.tasks[0]).toMatchObject({
        id: "US-001",
        title: "Parse PRD Markdown",
        metadata: {
          description: "As a maintainer, I want PRD markdown available through the control plane.",
          passes: false,
          qualityGates: [
            "`pnpm --filter @qa-sdk/cli test -- docs` passes.",
            "`pnpm --filter @qa-sdk/cli typecheck` passes.",
          ],
        },
      });
      expect(doc!.tasks[0]!.metadata.acceptanceCriteria).toEqual([
        { text: "Overview is collected.", checked: true },
        { text: "Open criteria remain visible.", checked: false },
      ]);
      expect(doc!.tasks[1]!.metadata.prerequisites).toEqual(["US-001"]);
    });
  });

  it("maps flat ralph PRD JSON stories to tasks and reports schema anti-patterns", async () => {
    await withTempWorkflow(async (rootDir) => {
      await writeFile(join(rootDir, "tasks/sample-prd.json"), JSON.stringify({
        name: "Sample Ralph PRD",
        branchName: "ralph/sample",
        description: "A tasks/prd-ontology-registry-cli-scenario-hardening.json-style fixture.",
        prd: {},
        tasks: [],
        metadata: {
          updatedAt: "2026-04-15T00:00:00.000Z",
        },
        userStories: [
          {
            id: "US-001",
            title: "Completed Story",
            description: "A completed story.",
            acceptanceCriteria: [
              "Feature works.",
              "`pnpm --filter @qa-sdk/cli test -- docs` passes.",
            ],
            priority: 1,
            passes: true,
            notes: "Implementation notes",
            dependsOn: [],
            completionNotes: "Completed by agent",
          },
          {
            id: "US-002",
            title: "Invalid Story",
            description: "A story with ralph JSON anti-patterns.",
            acceptanceCriteria: [],
            passes: "yes",
            status: "completed",
          },
        ],
      }, null, 2));

      const adapter = createRalphPrdJsonAdapter({
        rootDir,
        paths: ["tasks/sample-prd.json"],
      });
      const [doc] = await adapter.listDocuments();

      expect(doc).toMatchObject({
        adapterId: "ralph-prd-json",
        kind: "ralph-prd-json",
        stableId: "tasks/sample-prd",
        familyId: "tasks/sample-prd",
      });
      expect(doc!.metadata).toMatchObject({
        name: "Sample Ralph PRD",
        branchName: "ralph/sample",
        storyCount: 2,
        passedStoryCount: 1,
      });
      expect(doc!.tasks[0]).toMatchObject({
        id: "US-001",
        title: "Completed Story",
        metadata: {
          description: "A completed story.",
          priority: 1,
          passes: true,
          dependsOn: [],
          notes: "Implementation notes",
          completionNotes: "Completed by agent",
          acceptanceCriteria: [
            "Feature works.",
            "`pnpm --filter @qa-sdk/cli test -- docs` passes.",
          ],
          qualityGates: ["`pnpm --filter @qa-sdk/cli test -- docs` passes."],
        },
      });
      expect(doc!.tasks[1]).toMatchObject({
        id: "US-002",
        metadata: {
          passes: false,
          dependsOn: [],
          storyStatus: "completed",
        },
      });
      expect(doc!.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "ralph-prd-json-root-prd",
          "ralph-prd-json-root-tasks",
          "ralph-prd-json-root-metadata",
          "ralph-prd-json-story-status",
          "ralph-prd-json-story-passes-non-boolean",
          "ralph-prd-json-story-depends-on-missing",
        ]),
      );
    });
  });

  it("reports ralph session drift against PRD JSON story state", async () => {
    await withTempWorkflow(async (rootDir) => {
      await writeFile(join(rootDir, "tasks/completed-prd.json"), JSON.stringify({
        name: "Completed PRD",
        branchName: "ralph/completed",
        description: "Completed fixture.",
        userStories: [
          {
            id: "US-001",
            title: "One",
            description: "First story.",
            acceptanceCriteria: [],
            passes: true,
            notes: "",
            dependsOn: [],
            completionNotes: "Completed by agent",
          },
          {
            id: "US-002",
            title: "Two",
            description: "Second story.",
            acceptanceCriteria: [],
            passes: true,
            notes: "",
            dependsOn: ["US-001"],
            completionNotes: "Completed by agent",
          },
        ],
      }, null, 2));
      await writeFile(join(rootDir, ".ralph-tui/session-meta.json"), JSON.stringify({
        id: "session-1",
        status: "running",
        startedAt: "2026-04-15T00:00:00.000Z",
        updatedAt: "2026-04-15T00:10:00.000Z",
        agentPlugin: "codex",
        trackerPlugin: "json",
        prdPath: "tasks/completed-prd.json",
        currentIteration: 2,
        maxIterations: 0,
        totalTasks: 3,
        tasksCompleted: 1,
        cwd: rootDir,
      }, null, 2));

      const adapter = createRalphSessionAdapter({ rootDir });
      const [doc] = await adapter.listDocuments();

      expect(doc).toMatchObject({
        adapterId: "ralph-session",
        kind: "ralph-session",
        stableId: "ralph-session:session-1",
        familyId: "tasks/completed-prd",
        path: ".ralph-tui/session-meta.json",
        metadata: {
          id: "session-1",
          status: "running",
          prdPath: "tasks/completed-prd.json",
          prdStoryCount: 2,
          prdPassedStoryCount: 2,
          prdAllStoriesPassing: true,
        },
      });
      expect(doc!.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "ralph-session-prd-complete-session-running",
          "ralph-session-total-tasks-drift",
          "ralph-session-completed-tasks-drift",
        ]),
      );
    });
  });
});
