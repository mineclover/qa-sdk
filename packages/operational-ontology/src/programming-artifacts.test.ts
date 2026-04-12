import { describe, expect, it } from "vitest";

import { operationalOntologyPromptArtifactPlane } from "./prompt-artifacts.js";
import {
  PROGRAMMING_ARTIFACT_KINDS,
  PROGRAMMING_ARTIFACT_RELATION_KINDS,
  ArtifactRegistryPromptArtifactContextProvider,
  InMemoryProgrammingArtifactRegistryStore,
  createProgrammingArtifactRegistryRecord,
  programmingArtifactOntologyPack,
  validateProgrammingArtifactOntologyPack,
} from "./programming-artifacts.js";

describe("programming artifact ontology", () => {
  it("declares a valid pack schema and closed artifact vocabulary", () => {
    const validation = validateProgrammingArtifactOntologyPack();
    const axes = new Map(
      programmingArtifactOntologyPack.schema.axes.map((axis) => [axis.id, axis]),
    );

    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
    expect(axes.get("programming_artifact_kind")?.values).toEqual([
      "build",
      "generated-source",
      "quality-status",
      "deployment-output",
      "prompt-artifact",
    ]);
    expect(axes.get("programming_artifact_kind")?.capacity).toBe(16);
    expect(axes.get("programming_artifact_relation_kind")?.values).toEqual([
      "produced_by",
      "derived_from",
      "verifies",
      "owned_by_definition",
      "materializes_output",
    ]);
    expect(PROGRAMMING_ARTIFACT_KINDS).toHaveLength(5);
    expect(PROGRAMMING_ARTIFACT_RELATION_KINDS).toHaveLength(5);
  });

  it("resolves registry records through the prompt artifact provider contract", () => {
    const store = new InMemoryProgrammingArtifactRegistryStore([
      {
        artifactId: "quality-status-operational-ontology",
        artifactRef: "artifacts/quality-status-operational-ontology.json",
        kind: "quality-status",
        producedByRef: "qa-sdk quality status operational-ontology",
        ownerDefinitionId: "operational-ontology-prompt-artifact-generation",
        verifiesRefs: ["packages/operational-ontology/src/prompt-artifacts.test.ts"],
        materializesOutputRefs: ["operational-ontology-prompt-artifact-generation"],
        sourceRefs: ["packages/operational-ontology/src/internal/prompt-artifact-core.ts"],
        outputPath: "artifacts/quality-status-operational-ontology.json",
        verificationRefs: ["packages/operational-ontology/src/programming-artifacts.test.ts"],
      },
    ]);
    const artifactProvider = new ArtifactRegistryPromptArtifactContextProvider(store);
    const registry =
      new operationalOntologyPromptArtifactPlane.InMemoryPromptArtifactContextProviderRegistry([
        artifactProvider,
      ]);

    const resolved = registry.resolve({
      targetKind: "artifact",
      targetRef: "artifacts/quality-status-operational-ontology.json",
      useCase: "release_verification",
      now: "2026-04-12T00:00:00.000Z",
    });

    expect(resolved?.workArea.workAreaId).toBe(
      "artifact:quality-status-operational-ontology",
    );
    expect(resolved?.workArea.constraints).toEqual(
      expect.arrayContaining([
        "artifact-kind:quality-status",
        "produced_by:qa-sdk quality status operational-ontology",
        "owned_by_definition:operational-ontology-prompt-artifact-generation",
        "materializes_output:operational-ontology-prompt-artifact-generation",
      ]),
    );
    expect(resolved?.sources.traversals?.[0]?.traversal.edges).toEqual(
      expect.arrayContaining([
        "produced_by:artifact:quality-status-operational-ontology->artifact-relation:produced_by:qa-sdk-quality-status-operational-ontology",
        "owned_by_definition:artifact:quality-status-operational-ontology->operational-ontology-prompt-artifact-generation",
      ]),
    );

    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      useCase: "release_verification",
      workArea: resolved!.workArea,
      sources: resolved!.sources,
    });

    expect(artifact.sourceRefs).toEqual(
      expect.arrayContaining([
        "work-area:artifact:quality-status-operational-ontology",
        "corridor:artifact:quality-status-operational-ontology-definition-context",
        "governance-run:governance:artifact:quality-status-operational-ontology:definition-context",
      ]),
    );
  });

  it("creates registry records with normalized vocabulary relations", () => {
    const record = createProgrammingArtifactRegistryRecord({
      kind: "generated-source",
      artifactRef: "generated/index.ts",
      outputPath: "generated/index.ts",
      producedByRef: "qa-sdk codegen",
      derivedFromRefs: ["catalog:demo", "catalog:demo"],
      verifiesRefs: ["codegen-schema-output"],
      ownerDefinitionId: "codegen-schema-output",
      materializesOutputRefs: ["apm-codegen-system"],
      sourceRefs: ["qa-sdk.config.ts"],
      verificationRefs: ["packages/cli/src/commands/codegen.test.ts"],
      relations: [
        {
          kind: "produced_by",
          fromRef: "generated/index.ts",
          toRef: "qa-sdk codegen",
        },
      ],
      createdAt: "2026-04-12T00:00:00.000Z",
    });

    expect(record.artifactId).toBe("generated-source-generated-index-ts");
    expect(record.derivedFromRefs).toEqual(["catalog:demo"]);
    expect(record.relations).toEqual([
      {
        kind: "produced_by",
        fromRef: "generated/index.ts",
        toRef: "qa-sdk codegen",
      },
      {
        kind: "derived_from",
        fromRef: "generated/index.ts",
        toRef: "catalog:demo",
      },
      {
        kind: "verifies",
        fromRef: "generated/index.ts",
        toRef: "codegen-schema-output",
      },
      {
        kind: "owned_by_definition",
        fromRef: "generated/index.ts",
        toRef: "codegen-schema-output",
      },
      {
        kind: "materializes_output",
        fromRef: "generated/index.ts",
        toRef: "apm-codegen-system",
      },
    ]);
  });
});
