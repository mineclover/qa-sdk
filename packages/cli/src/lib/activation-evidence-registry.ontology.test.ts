import { describe, expect, it } from "vitest";

import {
  buildActivationEvidenceRegistryRecord,
  type ActivationEvidenceRegistryActivationResult,
} from "./activation-evidence-registry.js";

const GENERATED_AT = "2026-04-15T00:00:00.000Z";

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
      {
        activationStatus: "active",
        syncStatus: "deferred",
      },
    ],
    smokeCheckSummary: {
      allocationCount: 2,
      passedAllocationCount: 1,
      failedAllocationCount: 1,
      checkCount: 5,
      passedCheckCount: 4,
      failedCheckCount: 1,
      byAllocationId: {
        allocation_a: {
          passed: true,
        },
      },
    },
    warnings: [{ code: "sync-deferred" }],
    errors: [],
    ...overrides,
  };
}

describe("activation evidence registry mapper", () => {
  it("maps an activation result and sidecar path to an activation-evidence record", () => {
    const record = buildActivationEvidenceRegistryRecord({
      activationResult: activationResult(),
      resolvedOutputPath: "/repo/artifacts/activation/programming-artifact-ontology.json",
      commandContext: {
        packId: "programming-artifact-ontology",
        knownPackImportRef: "operational-ontology/programming-artifacts",
      },
      generatedAt: GENERATED_AT,
    });

    expect(record).toMatchObject({
      artifactId:
        "activation-evidence-programming-artifact-ontology-workspace-programming-artifacts",
      artifactRef: "/repo/artifacts/activation/programming-artifact-ontology.json",
      outputPath: "/repo/artifacts/activation/programming-artifact-ontology.json",
      kind: "activation-evidence",
      producedByRef:
        "qa-sdk ontology registry activate-pack programming-artifact-ontology",
      ownerDefinitionId: "operational-ontology-registry-activation-cli",
      createdAt: GENERATED_AT,
    });
    expect(record.derivedFromRefs).toEqual([
      "programming-artifact-ontology",
      "operational-ontology/programming-artifacts",
    ]);
    expect(record.verifiesRefs).toEqual([
      "programming-artifact-ontology",
      "workspace-programming-artifacts",
      "operational-ontology-registry-allocation",
    ]);
    expect(record.materializesOutputRefs).toEqual([
      "/repo/artifacts/activation/programming-artifact-ontology.json",
      "activation-result:programming-artifact-ontology:workspace-programming-artifacts",
    ]);
  });

  it("generates deterministic record identity from pack and ontology ids", () => {
    const first = buildActivationEvidenceRegistryRecord({
      activationResult: activationResult({
        packId: "Custom Pack",
        ontologyId: "Workspace/Ontology",
      }),
      resolvedOutputPath: "/repo/first.json",
      commandContext: { packId: "Custom Pack" },
      generatedAt: GENERATED_AT,
    });
    const second = buildActivationEvidenceRegistryRecord({
      activationResult: activationResult({
        packId: "Custom Pack",
        ontologyId: "Workspace/Ontology",
      }),
      resolvedOutputPath: "/repo/second.json",
      commandContext: { packId: "Custom Pack" },
      generatedAt: "2026-04-15T00:00:01.000Z",
    });

    expect(first.artifactId).toBe(
      "activation-evidence-custom-pack-workspace-ontology",
    );
    expect(second.artifactId).toBe(first.artifactId);
  });

  it("rejects missing output paths", () => {
    expect(() =>
      buildActivationEvidenceRegistryRecord({
        activationResult: activationResult(),
        commandContext: { packId: "programming-artifact-ontology" },
        generatedAt: GENERATED_AT,
      }),
    ).toThrow("requires resolved output path");

    expect(() =>
      buildActivationEvidenceRegistryRecord({
        activationResult: activationResult(),
        resolvedOutputPath: "   ",
        commandContext: { packId: "programming-artifact-ontology" },
        generatedAt: GENERATED_AT,
      }),
    ).toThrow("requires resolved output path");
  });

  it("summarizes activation metadata without enumerating generated prefixes", () => {
    const record = buildActivationEvidenceRegistryRecord({
      activationResult: activationResult({
        allocationSummaries: [
          { activationStatus: "active", syncStatus: "synced" },
          { activationStatus: "sync-blocked", syncStatus: "blocked" },
          { activationStatus: "skipped" },
        ],
        warnings: [{ code: "deferred" }, { code: "manual-review" }],
        errors: [{ code: "activation-smoke-check-failed" }],
      }),
      resolvedOutputPath: "/repo/artifacts/activation/programming-artifact-ontology.json",
      commandContext: {
        packId: "programming-artifact-ontology",
        knownPackImportRef: "operational-ontology/programming-artifacts",
      },
      generatedAt: GENERATED_AT,
    });

    expect(record.metadata).toEqual({
      status: "succeeded",
      packId: "programming-artifact-ontology",
      ontologyId: "workspace-programming-artifacts",
      namespace: "qa-sdk",
      allocationCount: 3,
      activationStatusCounts: {
        active: 1,
        "sync-blocked": 1,
        skipped: 1,
      },
      syncStatusCounts: {
        synced: 1,
        blocked: 1,
        none: 1,
      },
      smokeCheckSummary: {
        allocationCount: 2,
        passedAllocationCount: 1,
        failedAllocationCount: 1,
        checkCount: 5,
        passedCheckCount: 4,
        failedCheckCount: 1,
        byAllocationId: {
          allocation_a: {
            passed: true,
          },
        },
      },
      warningCount: 2,
      errorCount: 1,
      generatedAt: GENERATED_AT,
    });
  });
});
