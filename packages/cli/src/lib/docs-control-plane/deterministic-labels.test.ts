import { describe, expect, it } from "vitest";

import {
  buildDeterministicLabelRecord,
  buildSemanticCoordinateCandidate,
  collectSemanticCoordinateCandidatesFromDocuments,
  DETERMINISTIC_LABEL_RECORD_STATES,
  detectSemanticCoordinateCandidateCollisions,
  normalizeDocumentEnvelope,
  projectDeterministicLabelRecordsFromDocuments,
  SEMANTIC_COORDINATE_CANONICAL_EXAMPLES,
  SEMANTIC_COORDINATE_LABEL_KINDS,
  type CompletedRecordState,
  type DeterministicLabelRecord,
  type SemanticCoordinateCandidate,
  type SemanticCoordinateCandidateInput,
  type DocumentEnvelope,
} from "./index.js";

describe("semantic coordinate candidates", () => {
  it("supports the canonical deterministic label kinds", () => {
    expect(SEMANTIC_COORDINATE_LABEL_KINDS).toEqual([
      "definition-doc",
      "source-file",
      "ontology-pack",
      "artifact",
      "prd-markdown",
      "ralph-prd-json",
      "prd-story",
      "evidence",
    ]);
  });

  it("defines canonical candidate format examples", () => {
    expect(SEMANTIC_COORDINATE_CANONICAL_EXAMPLES).toEqual({
      definitionDoc: "urn:def:spec:docs-control-plane:v1",
      sourceFile: "urn:source:typescript:packages/cli/src/commands/docs.ts",
      ontologyPack: "urn:pack:ontology:programming-artifact-ontology:v1",
      artifact: "urn:artifact:activation-evidence:programming-artifact-ontology:v1",
      prdMarkdown: "urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      ralphPrdJson: "urn:prd:ralph-json:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      prdStory: "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-001",
      evidence: "urn:artifact:evidence:checkout-proof:v1",
    });
  });

  it("defines deterministic label record states for the future FSM projection", () => {
    expect(DETERMINISTIC_LABEL_RECORD_STATES).toEqual([
      "DRAFT",
      "LINTED",
      "RESOLVED",
      "ACTIVE",
      "DEPRECATED",
      "ARCHIVED",
      "BLOCKED",
    ]);
  });

  it("generates coordinates from representative ids without replacing source ids or paths", () => {
    const cases: Array<{
      readonly input: SemanticCoordinateCandidateInput;
      readonly label: string;
    }> = [
      {
        input: {
          kind: "definition-doc",
          id: "docs-control-plane",
          subtype: "spec",
          version: "v1",
          physicalRefs: [
            {
              kind: "definition-path",
              ref: "docs\\specs\\definition-catalog\\docs-control-plane.spec.md",
              role: "primary",
            },
          ],
        },
        label: "urn:def:spec:docs-control-plane:v1",
      },
      {
        input: {
          kind: "source-file",
          id: "packages\\cli\\src\\commands\\docs.ts",
          subtype: "typescript",
          physicalRefs: [
            {
              kind: "source-path",
              ref: "packages\\cli\\src\\commands\\docs.ts",
              role: "primary",
            },
          ],
        },
        label: "urn:source:typescript:packages/cli/src/commands/docs.ts",
      },
      {
        input: {
          kind: "ontology-pack",
          id: "programming-artifact-ontology",
          version: "v1",
          physicalRefs: [
            {
              kind: "pack-id",
              ref: "programming-artifact-ontology",
              role: "primary",
            },
          ],
        },
        label: "urn:pack:ontology:programming-artifact-ontology:v1",
      },
      {
        input: {
          kind: "artifact",
          id: "programming-artifact-ontology",
          subtype: "activation-evidence",
          version: "v1",
          physicalRefs: [
            {
              kind: "artifact-output-path",
              ref: "artifacts/activation/programming-artifact-ontology.json",
              role: "primary",
            },
          ],
        },
        label: "urn:artifact:activation-evidence:programming-artifact-ontology:v1",
      },
      {
        input: {
          kind: "prd-markdown",
          id: "tasks/prd-deterministic-label-registry-fsm-read-model",
          version: "v1",
          physicalRefs: [
            {
              kind: "prd-path",
              ref: "tasks/prd-deterministic-label-registry-fsm-read-model.md",
              role: "primary",
            },
          ],
        },
        label: "urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      },
      {
        input: {
          kind: "ralph-prd-json",
          id: "tasks/prd-deterministic-label-registry-fsm-read-model",
          version: "v1",
          physicalRefs: [
            {
              kind: "ralph-prd-json-path",
              ref: "tasks/prd-deterministic-label-registry-fsm-read-model.json",
              role: "primary",
            },
          ],
        },
        label: "urn:prd:ralph-json:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      },
      {
        input: {
          kind: "prd-story",
          parentId: "tasks/prd-deterministic-label-registry-fsm-read-model",
          id: "US-001",
          physicalRefs: [
            {
              kind: "ralph-prd-json-path",
              ref: "tasks/prd-deterministic-label-registry-fsm-read-model.json#/userStories/0",
              role: "primary",
            },
          ],
        },
        label: "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-001",
      },
      {
        input: {
          kind: "evidence",
          id: "checkout-proof",
          version: "v1",
          physicalRefs: [
            {
              kind: "evidence-ref",
              ref: "artifacts/checkout-proof.json",
              role: "primary",
            },
          ],
        },
        label: "urn:artifact:evidence:checkout-proof:v1",
      },
    ];

    for (const { input, label } of cases) {
      const result = buildSemanticCoordinateCandidate(input);
      expect(result.diagnostics).toEqual([]);
      expect(result.candidate).toMatchObject({
        label,
        id: input.id.replaceAll("\\", "/"),
        originalId: input.id,
      });
      expect(result.candidate?.physicalRefs[0]?.ref).toBe(
        input.physicalRefs?.[0]?.ref.replaceAll("\\", "/"),
      );
    }
  });

  it("reports missing kind, invalid version, and ambiguous physical refs as diagnostics", () => {
    const missingKind = buildSemanticCoordinateCandidate({
      id: "docs-control-plane",
    });
    expect(missingKind.candidate).toBeUndefined();
    expect(missingKind.diagnostics).toEqual([
      expect.objectContaining({
        code: "semantic-coordinate-missing-kind",
        severity: "error",
      }),
    ]);

    const invalidVersion = buildSemanticCoordinateCandidate({
      kind: "definition-doc",
      id: "docs-control-plane",
      version: "1",
    });
    expect(invalidVersion.candidate?.label).toBe("urn:def:spec:docs-control-plane");
    expect(invalidVersion.diagnostics).toEqual([
      expect.objectContaining({
        code: "semantic-coordinate-invalid-version",
        severity: "error",
      }),
    ]);

    const ambiguousPhysicalRef = buildSemanticCoordinateCandidate({
      kind: "definition-doc",
      id: "docs-control-plane",
      version: "v1",
      physicalRefs: [
        {
          kind: "definition-path",
          ref: "docs/specs/definition-catalog/docs-control-plane.spec.md",
          role: "primary",
        },
        {
          kind: "definition-path",
          ref: "docs/specs/definition-catalog/archive/docs-control-plane.spec.md",
          role: "primary",
        },
      ],
    });
    expect(ambiguousPhysicalRef.candidate?.diagnostics).toEqual([
      expect.objectContaining({
        code: "semantic-coordinate-ambiguous-physical-ref",
        severity: "warning",
      }),
    ]);
  });

  it("reports collision candidates when one label maps to distinct physical records", () => {
    const first = candidate({
      kind: "definition-doc",
      id: "docs-control-plane",
      version: "v1",
      physicalRefs: [
        {
          kind: "definition-path",
          ref: "docs/specs/definition-catalog/docs-control-plane.spec.md",
          role: "primary",
        },
      ],
    });
    const second = candidate({
      kind: "definition-doc",
      id: "docs-control-plane",
      version: "v1",
      physicalRefs: [
        {
          kind: "definition-path",
          ref: "docs/specs/definition-catalog/duplicate/docs-control-plane.spec.md",
          role: "primary",
        },
      ],
    });

    expect(detectSemanticCoordinateCandidateCollisions([first, second])).toEqual([
      expect.objectContaining({
        code: "semantic-coordinate-collision-candidate",
        severity: "error",
        label: "urn:def:spec:docs-control-plane:v1",
      }),
    ]);
  });

  it("maps existing document ids and physical refs into inventory candidates", () => {
    const docs = [
      definitionDoc(),
      prdMarkdownDoc(),
      ralphPrdJsonDoc(),
      artifactEvidenceDoc(),
    ];

    const inventory = collectSemanticCoordinateCandidatesFromDocuments(docs);
    const labels = inventory.candidates.map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining([
      "urn:def:spec:docs-control-plane-def:v1",
      "urn:def:spec:docs-control-plane-stable:v1",
      "urn:def:family:docs/specs/definition-catalog/docs-control-plane:v1",
      "urn:source:markdown:docs/specs/definition-catalog/docs-control-plane.spec.md",
      "urn:source:typescript:packages/cli/src/commands/docs.ts",
      "urn:pack:ontology:programming-artifact-ontology:v1",
      "urn:artifact:activation-evidence:activation-evidence-programming-artifact-ontology:v1",
      "urn:artifact:activation-evidence:activation-evidence-proof:v1",
      "urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      "urn:prd:ralph-json:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-002",
    ]));

    expect(candidateByLabel(
      inventory.candidates,
      "urn:def:spec:docs-control-plane-def:v1",
    )?.metadata).toMatchObject({
      idSource: "def.id",
      documentStableId: "docs-control-plane-stable",
    });
    expect(candidateByLabel(
      inventory.candidates,
      "urn:source:typescript:packages/cli/src/commands/docs.ts",
    )?.physicalRefs).toEqual([
      expect.objectContaining({
        kind: "source-path",
        ref: "packages/cli/src/commands/docs.ts",
        role: "primary",
      }),
    ]);
    expect(candidateByLabel(
      inventory.candidates,
      "urn:artifact:activation-evidence:activation-evidence-programming-artifact-ontology:v1",
    )?.physicalRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "artifact-output-path",
        ref: "artifacts/activation/programming-artifact-ontology.json",
        role: "primary",
      }),
      expect.objectContaining({
        kind: "artifact-ref",
        ref: "artifacts/programming-artifacts.json#/artifacts/0",
      }),
    ]));
    expect(inventory.diagnostics).toEqual([
      expect.objectContaining({
        code: "semantic-coordinate-collision-candidate",
        label: "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-002",
      }),
    ]);
  });

  it("keeps duplicate labels as candidates and reports diagnostics", () => {
    const first = definitionDoc({
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
      metadata: {
        defId: "checkout",
        sourcePath: "docs/specs/checkout/checkout.spec.md",
        documentKind: "spec",
      },
    });
    const second = definitionDoc({
      stableId: "checkout-spec-copy",
      familyId: "docs/specs/checkout-copy/checkout",
      path: "docs/specs/checkout-copy/checkout.spec.md",
      metadata: {
        defId: "checkout",
        sourcePath: "docs/specs/checkout-copy/checkout.spec.md",
        documentKind: "spec",
      },
    });

    const inventory = collectSemanticCoordinateCandidatesFromDocuments([first, second]);
    const duplicateLabel = "urn:def:spec:checkout:v1";

    expect(inventory.candidates.filter((item) => item.label === duplicateLabel)).toHaveLength(2);
    expect(inventory.diagnostics).toEqual([
      expect.objectContaining({
        code: "semantic-coordinate-collision-candidate",
        label: duplicateLabel,
      }),
    ]);
  });

  it("excludes archive PRDs and transient session documents unless targeted or opted in", () => {
    const archived = prdMarkdownDoc({
      stableId: "tasks/archive/archived-prd",
      familyId: "tasks/archive/archived-prd",
      path: "tasks/archive/archived-prd.md",
      metadata: {
        title: "Archived PRD",
        sourcePath: "tasks/archive/archived-prd.md",
      },
    });
    const session = normalizeDocumentEnvelope({
      adapterId: "ralph-session",
      kind: "ralph-session",
      stableId: "ralph-session:current",
      familyId: "tasks/prd-deterministic-label-registry-fsm-read-model",
      path: ".ralph-tui/session-meta.json",
      metadata: {
        sourcePath: ".ralph-tui/session-meta.json",
      },
      rawSource: {
        path: ".ralph-tui/session-meta.json",
        sourceSchema: "ralph-session",
      },
    });

    const defaultInventory = collectSemanticCoordinateCandidatesFromDocuments([archived, session]);
    expect(defaultInventory.candidates).toEqual([]);
    expect(defaultInventory.skippedDocuments).toEqual([
      expect.objectContaining({ path: "tasks/archive/archived-prd.md", reason: "archive" }),
      expect.objectContaining({ path: ".ralph-tui/session-meta.json", reason: "session" }),
    ]);

    expect(collectSemanticCoordinateCandidatesFromDocuments([archived], {
      exactTarget: "tasks/archive/archived-prd.md",
    }).candidates.map((item) => item.label)).toContain(
      "urn:prd:markdown:tasks/archive/archived-prd:v1",
    );
    expect(collectSemanticCoordinateCandidatesFromDocuments([archived], {
      includeArchive: true,
    }).candidates.map((item) => item.label)).toContain(
      "urn:prd:markdown:tasks/archive/archived-prd:v1",
    );
    expect(collectSemanticCoordinateCandidatesFromDocuments([session], {
      includeSession: true,
    }).candidates.map((item) => item.label)).toContain(
      "urn:source:json:.ralph-tui/session-meta.json",
    );
  });

  it("constructs a read-only deterministic label record with empty relationship refs", () => {
    const source = candidate({
      kind: "definition-doc",
      id: "docs-control-plane",
      subtype: "spec",
      version: "v1",
      physicalRefs: [
        {
          kind: "definition-path",
          ref: "docs/specs/definition-catalog/docs-control-plane.spec.md",
          role: "primary",
        },
      ],
    });

    const record = buildDeterministicLabelRecord({ candidate: source });

    expect(record).toMatchObject({
      label: "urn:def:spec:docs-control-plane:v1",
      kind: "definition-doc",
      currentState: "DRAFT",
      dependencyLabels: [],
      sourceRefs: [],
      evidenceRefs: [],
      diagnostics: [],
      candidate: source,
    });
    expect(record.physicalRefs).toEqual([
      expect.objectContaining({
        kind: "definition-path",
        ref: "docs/specs/definition-catalog/docs-control-plane.spec.md",
        role: "primary",
      }),
    ]);
  });

  it("constructs a deterministic label record with populated dependency, source, and evidence refs", () => {
    const source = candidate({
      kind: "prd-story",
      parentId: "tasks/prd-deterministic-label-registry-fsm-read-model",
      id: "US-003",
      physicalRefs: [
        {
          kind: "ralph-prd-json-path",
          ref: "tasks\\prd-deterministic-label-registry-fsm-read-model.json#/userStories/2",
          role: "primary",
        },
      ],
      metadata: {
        documentStableId: "tasks/prd-deterministic-label-registry-fsm-read-model",
      },
    });

    const record = buildDeterministicLabelRecord({
      candidate: source,
      currentState: "LINTED",
      dependencyLabels: [
        "urn:def:spec:docs-control-plane:v1",
        " ",
        "urn:def:spec:definition-catalog:v1",
        "urn:def:spec:docs-control-plane:v1",
      ],
      sourceRefs: [
        "packages\\cli\\src\\lib\\docs-control-plane\\deterministic-labels.ts",
        "packages/cli/src/lib/docs-control-plane/deterministic-labels.test.ts",
      ],
      evidenceRefs: [
        "urn:artifact:evidence:us-003-proof:v1",
        "urn:artifact:evidence:us-003-proof:v1",
      ],
      metadata: {
        projection: "record-shape",
      },
    });

    expect(record).toMatchObject({
      label: "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-003",
      kind: "prd-story",
      currentState: "LINTED",
      dependencyLabels: [
        "urn:def:spec:definition-catalog:v1",
        "urn:def:spec:docs-control-plane:v1",
      ],
      sourceRefs: [
        "packages/cli/src/lib/docs-control-plane/deterministic-labels.test.ts",
        "packages/cli/src/lib/docs-control-plane/deterministic-labels.ts",
      ],
      evidenceRefs: [
        "urn:artifact:evidence:us-003-proof:v1",
      ],
      metadata: {
        documentStableId: "tasks/prd-deterministic-label-registry-fsm-read-model",
        projection: "record-shape",
      },
      candidate: source,
    });
    expect(record.physicalRefs).toEqual([
      expect.objectContaining({
        kind: "ralph-prd-json-path",
        ref: "tasks/prd-deterministic-label-registry-fsm-read-model.json#/userStories/2",
        role: "primary",
      }),
    ]);
  });

  it("projects definition markdown envelopes into records with dependency, source, and evidence refs", () => {
    const target = definitionDoc({
      stableId: "definition-catalog-spec",
      familyId: "docs/specs/definition-catalog/definition-catalog",
      path: "docs/specs/definition-catalog/definition-catalog.spec.md",
      metadata: {
        defId: "definition-catalog-spec",
        sourcePath: "docs/specs/definition-catalog/definition-catalog.spec.md",
        documentKind: "spec",
      },
    });
    const source = definitionDoc({
      links: [
        {
          type: "depends_on",
          sourceId: "docs-control-plane-def",
          targetId: "definition-catalog-spec",
        },
      ],
      evidence: [
        {
          id: "docs-control-plane-proof",
          kind: "validation-evidence",
          rawSource: {
            path: "artifacts/docs-control-plane-proof.json",
          },
        },
      ],
    });

    const projection = projectDeterministicLabelRecordsFromDocuments([source, target]);
    const record = recordByLabel(
      projection.records,
      "urn:def:spec:docs-control-plane-def:v1",
    );

    expect(record).toMatchObject({
      dependencyLabels: ["urn:def:spec:definition-catalog-spec:v1"],
      sourceRefs: ["urn:source:typescript:packages/cli/src/commands/docs.ts"],
      evidenceRefs: ["urn:artifact:validation-evidence:docs-control-plane-proof:v1"],
      metadata: {
        projection: "document-envelope",
        documentScope: "active",
        activeScope: true,
        archiveScope: false,
      },
    });
    expect(projection.records.map((item) => item.label)).toEqual(expect.arrayContaining([
      "urn:source:typescript:packages/cli/src/commands/docs.ts",
      "urn:artifact:validation-evidence:docs-control-plane-proof:v1",
    ]));
  });

  it("projects PRD markdown and ralph PRD JSON envelopes into document and story records", () => {
    const prd = prdMarkdownDoc({
      metadata: {
        contextSources: [
          "packages/cli/src/lib/docs-control-plane/deterministic-labels.ts",
        ],
      },
      tasks: [
        {
          id: "US-004",
          title: "Project DocumentEnvelope Inputs Into Label Records",
          evidenceIds: ["prd-projection-proof"],
          rawSource: {
            path: "tasks/prd-deterministic-label-registry-fsm-read-model.md",
            pointer: "### US-004",
          },
          metadata: {
            prerequisites: ["US-003"],
          },
        },
      ],
    });
    const ralph = ralphPrdJsonDoc({
      tasks: [
        {
          id: "US-004",
          title: "Project DocumentEnvelope Inputs Into Label Records",
          evidenceIds: ["ralph-projection-proof"],
          rawSource: {
            path: "tasks/prd-deterministic-label-registry-fsm-read-model.json",
            pointer: "/userStories/3",
          },
          metadata: {
            dependsOn: ["US-003"],
            passes: false,
          },
        },
      ],
    });

    const projection = projectDeterministicLabelRecordsFromDocuments([prd, ralph]);
    const labels = projection.records.map((item) => item.label);
    const ralphStory = projection.records.find((item) =>
      item.label === "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-004"
      && item.physicalRefs.some((ref) => ref.kind === "ralph-prd-json-path")
    );

    expect(labels).toEqual(expect.arrayContaining([
      "urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      "urn:prd:ralph-json:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
      "urn:source:typescript:packages/cli/src/lib/docs-control-plane/deterministic-labels.ts",
    ]));
    expect(recordByLabel(
      projection.records,
      "urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1",
    ).sourceRefs).toContain(
      "urn:source:typescript:packages/cli/src/lib/docs-control-plane/deterministic-labels.ts",
    );
    expect(ralphStory).toMatchObject({
      dependencyLabels: [
        "urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-003",
      ],
      evidenceRefs: [
        "urn:artifact:evidence:ralph-projection-proof:v1",
      ],
    });
  });

  it("preserves active/archive scope and completed-record metadata on projected records", () => {
    const archived = prdMarkdownDoc({
      stableId: "tasks/archive/prd-completed",
      familyId: "tasks/archive/prd-completed",
      path: "tasks/archive/prd-completed.md",
      metadata: {
        title: "Completed PRD",
        sourcePath: "tasks/archive/prd-completed.md",
        lifecycle: "archived",
      },
    });
    const completedRecord: CompletedRecordState = {
      source: "prd-markdown",
      kind: "prd",
      documentId: "tasks/archive/prd-completed",
      path: "tasks/archive/prd-completed.md",
      state: "completed-record",
      title: "Completed PRD",
      lifecycle: "archived",
      storyCount: 2,
      passedStoryCount: 2,
      pairedDocumentId: "tasks/archive/prd-completed",
      pairedPath: "tasks/archive/prd-completed.json",
      reason: "paired PRD JSON has all stories passing",
    };

    const skipped = projectDeterministicLabelRecordsFromDocuments([archived]);
    expect(skipped.records).toEqual([]);
    expect(skipped.skippedDocuments).toEqual([
      expect.objectContaining({
        path: "tasks/archive/prd-completed.md",
        reason: "archive",
      }),
    ]);

    const included = projectDeterministicLabelRecordsFromDocuments([archived], {
      includeArchive: true,
      completedRecords: [completedRecord],
    });
    const record = recordByLabel(
      included.records,
      "urn:prd:markdown:tasks/archive/prd-completed:v1",
    );

    expect(record.metadata).toMatchObject({
      documentScope: "archive",
      activeScope: false,
      archiveScope: true,
      completedRecord: {
        state: "completed-record",
        lifecycle: "archived",
        storyCount: 2,
        passedStoryCount: 2,
        reason: "paired PRD JSON has all stories passing",
      },
    });
  });
});

function candidate(
  input: SemanticCoordinateCandidateInput,
): SemanticCoordinateCandidate {
  const result = buildSemanticCoordinateCandidate(input);
  expect(result.candidate).toBeDefined();
  return result.candidate!;
}

function candidateByLabel(
  candidates: readonly SemanticCoordinateCandidate[],
  label: string,
): SemanticCoordinateCandidate | undefined {
  return candidates.find((candidate) => candidate.label === label);
}

function recordByLabel(
  records: readonly DeterministicLabelRecord[],
  label: string,
): DeterministicLabelRecord {
  const record = records.find((candidate) => candidate.label === label);
  expect(record).toBeDefined();
  return record!;
}

function definitionDoc(
  overrides: Partial<Parameters<typeof normalizeDocumentEnvelope>[0]> = {},
): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: "definition-markdown",
    kind: "spec",
    stableId: "docs-control-plane-stable",
    familyId: "docs/specs/definition-catalog/docs-control-plane",
    path: "docs/specs/definition-catalog/docs-control-plane.spec.md",
    metadata: {
      defId: "docs-control-plane-def",
      sourcePath: "docs/specs/definition-catalog/docs-control-plane.spec.md",
      documentKind: "spec",
      ...(overrides.metadata ?? {}),
    },
    sources: [
      {
        id: "docs-command",
        path: "packages/cli/src/commands/docs.ts",
        metadata: {
          sourceKind: "doc_frontmatter",
        },
      },
      ...(overrides.sources ?? []),
    ],
    evidence: [
      ...(overrides.evidence ?? []),
    ],
    rawSource: {
      path: "docs/specs/definition-catalog/docs-control-plane.spec.md",
      sourceSchema: "definition-frontmatter",
      ...(overrides.rawSource ?? {}),
    },
    ...withoutEnvelopeNested(overrides),
  });
}

function prdMarkdownDoc(
  overrides: Partial<Parameters<typeof normalizeDocumentEnvelope>[0]> = {},
): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: "prd-markdown",
    kind: "prd",
    stableId: "tasks/prd-deterministic-label-registry-fsm-read-model",
    familyId: "tasks/prd-deterministic-label-registry-fsm-read-model",
    path: "tasks/prd-deterministic-label-registry-fsm-read-model.md",
    metadata: {
      title: "Deterministic Label Registry FSM Read Model",
      sourcePath: "tasks/prd-deterministic-label-registry-fsm-read-model.md",
      ...(overrides.metadata ?? {}),
    },
    tasks: [
      {
        id: "US-002",
        title: "Map Existing IDs To Label Candidates",
        rawSource: {
          path: "tasks/prd-deterministic-label-registry-fsm-read-model.md",
          pointer: "### US-002",
        },
      },
      ...(overrides.tasks ?? []),
    ],
    rawSource: {
      path: "tasks/prd-deterministic-label-registry-fsm-read-model.md",
      sourceSchema: "prd-markdown",
      ...(overrides.rawSource ?? {}),
    },
    ...withoutEnvelopeNested(overrides),
  });
}

function ralphPrdJsonDoc(
  overrides: Partial<Parameters<typeof normalizeDocumentEnvelope>[0]> = {},
): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: "ralph-prd-json",
    kind: "ralph-prd-json",
    stableId: "tasks/prd-deterministic-label-registry-fsm-read-model",
    familyId: "tasks/prd-deterministic-label-registry-fsm-read-model",
    path: "tasks/prd-deterministic-label-registry-fsm-read-model.json",
    metadata: {
      name: "Deterministic Label Registry FSM Read Model",
      sourcePath: "tasks/prd-deterministic-label-registry-fsm-read-model.json",
      ...(overrides.metadata ?? {}),
    },
    tasks: [
      {
        id: "US-002",
        title: "Map Existing IDs To Label Candidates",
        rawSource: {
          path: "tasks/prd-deterministic-label-registry-fsm-read-model.json",
          pointer: "/userStories/1",
        },
      },
      ...(overrides.tasks ?? []),
    ],
    rawSource: {
      path: "tasks/prd-deterministic-label-registry-fsm-read-model.json",
      sourceSchema: "ralph-prd-json",
      ...(overrides.rawSource ?? {}),
    },
    ...withoutEnvelopeNested(overrides),
  });
}

function artifactEvidenceDoc(
  overrides: Partial<Parameters<typeof normalizeDocumentEnvelope>[0]> = {},
): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: "artifact-evidence",
    kind: "activation-evidence",
    stableId: "activation-evidence-programming-artifact-ontology",
    familyId: "docs-control-plane-def",
    path: "artifacts/activation/programming-artifact-ontology.json",
    metadata: {
      artifactId: "activation-evidence-programming-artifact-ontology",
      artifactKind: "activation-evidence",
      artifactRef: "artifacts/programming-artifacts.json#/artifacts/0",
      outputPath: "artifacts/activation/programming-artifact-ontology.json",
      packId: "programming-artifact-ontology",
      sourcePath: "artifacts/programming-artifacts.json",
      ...(overrides.metadata ?? {}),
    },
    evidence: [
      {
        id: "activation-evidence-proof",
        kind: "activation-evidence",
        rawSource: {
          path: "artifacts/programming-artifacts.json",
          pointer: "/artifacts/0",
        },
      },
      ...(overrides.evidence ?? []),
    ],
    rawSource: {
      path: "artifacts/programming-artifacts.json",
      sourceSchema: "programming-artifact-registry",
      ...(overrides.rawSource ?? {}),
    },
    ...withoutEnvelopeNested(overrides),
  });
}

function withoutEnvelopeNested(
  input: Partial<Parameters<typeof normalizeDocumentEnvelope>[0]>,
): Partial<Parameters<typeof normalizeDocumentEnvelope>[0]> {
  const {
    metadata: _metadata,
    sources: _sources,
    tasks: _tasks,
    evidence: _evidence,
    rawSource: _rawSource,
    ...rest
  } = input;
  return rest;
}
