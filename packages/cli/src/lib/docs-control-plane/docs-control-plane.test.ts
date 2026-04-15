import { describe, expect, it } from "vitest";

import {
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

