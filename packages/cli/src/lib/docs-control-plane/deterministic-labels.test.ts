import { describe, expect, it } from "vitest";

import {
  buildSemanticCoordinateCandidate,
  detectSemanticCoordinateCandidateCollisions,
  SEMANTIC_COORDINATE_CANONICAL_EXAMPLES,
  SEMANTIC_COORDINATE_LABEL_KINDS,
  type SemanticCoordinateCandidate,
  type SemanticCoordinateCandidateInput,
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
});

function candidate(
  input: SemanticCoordinateCandidateInput,
): SemanticCoordinateCandidate {
  const result = buildSemanticCoordinateCandidate(input);
  expect(result.candidate).toBeDefined();
  return result.candidate!;
}
