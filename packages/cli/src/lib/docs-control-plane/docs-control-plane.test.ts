import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createDefinitionMarkdownAdapter,
  declareDocumentAdapterCapabilities,
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
} from "./index.js";

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
