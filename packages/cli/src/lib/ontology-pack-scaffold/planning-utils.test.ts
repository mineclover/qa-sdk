// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from "vitest";

import { deriveOntologyPackScaffoldSymbols } from "../ontology-pack-scaffold-plan.js";
import { createKnownPackCandidate } from "./known-pack-candidate.js";
import {
  detectConflictingOutputPaths,
  resolveSafeRepoPath,
} from "./paths.js";
import { createOntologyPackSourceMapPlan } from "./source-map-candidates.js";

describe("ontology pack scaffold planning utilities", () => {
  it("normalizes safe repo paths and preserves unsafe path diagnostics", () => {
    const diagnostics: Parameters<typeof resolveSafeRepoPath>[0]["diagnostics"] = [];

    expect(resolveSafeRepoPath({
      rootDir: "/repo",
      field: "packageRoot",
      inputPath: "packages/generated-risk/../custom-risk",
      fallbackPath: "packages/operational-ontology",
      diagnostics,
    })).toBe("packages/custom-risk");
    expect(resolveSafeRepoPath({
      rootDir: "/repo",
      field: "docsDir",
      inputPath: "../outside",
      fallbackPath: "docs/specs/operational-ontology",
      diagnostics,
    })).toBe("docs/specs/operational-ontology");

    expect(diagnostics).toEqual([
      {
        severity: "error",
        code: "unsafe-path",
        message:
          'Path option "docsDir" must resolve inside the repository and must not be empty.',
        field: "docsDir",
        value: "../outside",
      },
    ]);
  });

  it("detects duplicate planned output paths with role details", () => {
    expect(detectConflictingOutputPaths([
      { role: "system-binding", path: "packages/example/src/internal/foo-pack.ts" },
      { role: "pack-validation-test", path: "packages/example/src/internal/foo-pack.ts" },
      { role: "docs-spec", path: "docs/specs/example/foo-system.spec.md" },
    ])).toEqual([
      {
        severity: "error",
        code: "conflicting-output-path",
        message:
          'Output path "packages/example/src/internal/foo-pack.ts" is planned for multiple scaffold artifacts.',
        path: "packages/example/src/internal/foo-pack.ts",
        details: {
          roles: ["system-binding", "pack-validation-test"],
        },
      },
    ]);
  });

  it("builds source-map candidates, frontmatter candidates, and guidance", () => {
    const sourceMapPlan = createOntologyPackSourceMapPlan({
      primaryDoc: {
        docId: "risk-model-ontology-system",
        docPath: "docs/specs/operational-ontology/risk-model-ontology-system.spec.md",
        sources: [
          {
            sourcePath: "packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
            sourceRole: "component-schema",
          },
          {
            sourcePath: "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
            sourceRole: "system-binding",
          },
          {
            sourcePath: "packages/operational-ontology/src/risk-model-ontology.test.ts",
            sourceRole: "test",
          },
        ],
      },
      additionalDocs: [{
        docId: "risk-model-ontology-test",
        docPath: "docs/specs/operational-ontology/risk-model-ontology.test.md",
        sources: [{
          sourcePath: "packages/operational-ontology/src/risk-model-ontology.test.ts",
          sourceRole: "test",
        }],
      }],
    });

    expect(sourceMapPlan.candidates).toHaveLength(4);
    expect(sourceMapPlan.candidates[0]).toMatchObject({
      docId: "risk-model-ontology-system",
      sourceRole: "component-schema",
      frontmatterKey: "sources",
      sourceFileKind: "generated-file",
      candidateKind: "suggested-doc-edit",
      applyMode: "candidate-only",
    });
    expect(sourceMapPlan.frontmatterCandidates).toEqual([
      expect.objectContaining({
        docId: "risk-model-ontology-system",
        sources: [
          "packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
          "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
          "packages/operational-ontology/src/risk-model-ontology.test.ts",
        ],
        yaml: [
          "sources:",
          "  - packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
          "  - packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
          "  - packages/operational-ontology/src/risk-model-ontology.test.ts",
        ].join("\n"),
      }),
      expect.objectContaining({
        docId: "risk-model-ontology-test",
        sources: ["packages/operational-ontology/src/risk-model-ontology.test.ts"],
      }),
    ]);
    expect(sourceMapPlan.guidance.findByFileCommands).toEqual([
      "qa-sdk def find-by-file packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
      "qa-sdk def find-by-file packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
      "qa-sdk def find-by-file packages/operational-ontology/src/risk-model-ontology.test.ts",
    ]);
  });

  it("builds known-pack registration candidates without resolver mutation", () => {
    const symbols = deriveOntologyPackScaffoldSymbols("risk-model-ontology");

    expect(createKnownPackCandidate({
      packId: "risk-model-ontology",
      implementationPackage: "operational-ontology",
      symbols,
    })).toEqual({
      targetPath: "packages/cli/src/lib/known-ontology-packs.ts",
      packId: "risk-model-ontology",
      importPath: "operational-ontology",
      exportSymbolName: "riskModelOntologyPack",
      importName: "riskModelOntologyPack",
      moduleSpecifier: "operational-ontology",
      registryEntry: '"risk-model-ontology": riskModelOntologyPack',
      registrationMode: "manual",
      applyMode: "candidate-only",
    });
  });
});
