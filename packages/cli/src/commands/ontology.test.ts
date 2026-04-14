import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { SqliteQualityStore } from "quality-ledger";
import { cliOntology } from "./ontology.js";
import { USAGE, main, resolveSubcommand } from "../index.js";
import {
  KNOWN_ONTOLOGY_PACK_IDS,
  resolveKnownOntologyPack,
} from "../lib/known-ontology-packs.js";

describe("ontology CLI", () => {
  it("known pack resolver resolves activation pack ids without store setup", () => {
    expect(KNOWN_ONTOLOGY_PACK_IDS).toEqual([
      "programming-artifact-ontology",
      "authorization-ontology",
    ]);

    const programmingArtifact = resolveKnownOntologyPack(
      "programming-artifact-ontology",
    );
    const authorization = resolveKnownOntologyPack("authorization-ontology");

    expect(programmingArtifact).toMatchObject({
      ok: true,
      packId: "programming-artifact-ontology",
      pack: { packId: "programming-artifact-ontology" },
    });
    expect(authorization).toMatchObject({
      ok: true,
      packId: "authorization-ontology",
      pack: { packId: "authorization-ontology" },
    });
  });

  it("known pack resolver reports unknown pack ids as structured errors", () => {
    const result = resolveKnownOntologyPack("custom-fixture-pack");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "unknown-ontology-pack",
        message:
          'Unknown ontology pack id "custom-fixture-pack". Supported pack ids: programming-artifact-ontology, authorization-ontology',
        packId: "custom-fixture-pack",
        supportedPackIds: KNOWN_ONTOLOGY_PACK_IDS,
      },
    });
  });

  it("usage와 subcommand 해석에 ontology 루트를 노출한다", () => {
    expect(USAGE).toContain("qa-sdk ontology status");
    expect(USAGE).toContain("qa-sdk ontology registry activate-pack <pack-id>");
    expect(USAGE).toContain("qa-sdk ontology prompt extract");
    expect(USAGE).toContain("qa-sdk ontology prompt extract-file");
    expect(USAGE).toContain("qa-sdk ontology prompt extract-permission");
    expect(USAGE).toContain("qa-sdk ontology prompt extract-artifact");
    expect(USAGE).toContain("--quality-ledger <path>");
    expect(USAGE).toContain("--quality-status-max-age-days <n>");
    expect(USAGE).toContain("qa-sdk ontology artifact registry validate");
    expect(USAGE).toContain("qa-sdk ontology artifact registry append");
    expect(USAGE).toContain("qa-sdk ontology snapshot ingest");
    expect(USAGE).toContain("qa-sdk ontology corridor list");
    expect(USAGE).toContain("qa-sdk ontology checkpoint list");
    expect(USAGE).toContain("qa-sdk ontology checkpoint show");
    expect(USAGE).toContain("qa-sdk ontology checkpoint diff");
    expect(USAGE).toContain("qa-sdk ontology checkpoint diff-latest");
    expect(USAGE).toContain("qa-sdk ontology junction list");
    expect(USAGE).toContain("qa-sdk ontology junction show");
    expect(USAGE).toContain("qa-sdk ontology junction diff");
    expect(USAGE).toContain("qa-sdk ontology junction diff-latest");
    expect(USAGE).toContain("qa-sdk ontology route list");
    expect(USAGE).toContain("qa-sdk ontology route show");
    expect(USAGE).toContain("qa-sdk ontology route diff");
    expect(USAGE).toContain("qa-sdk ontology route diff-latest");
    expect(USAGE).toContain("qa-sdk ontology traversal list");
    expect(USAGE).toContain("qa-sdk ontology traversal show");
    expect(USAGE).toContain("qa-sdk ontology traversal diff");
    expect(USAGE).toContain("qa-sdk ontology traversal diff-latest");
    expect(USAGE).toContain("qa-sdk ontology snapshot diff");
    expect(USAGE).toContain("qa-sdk ontology snapshot diff-latest");
    expect(USAGE).toContain("qa-sdk ontology corridor diff");
    expect(USAGE).toContain("qa-sdk ontology corridor diff-latest");
    expect(USAGE).toContain("qa-sdk ontology corridor show");
    expect(
      resolveSubcommand([
        "ontology",
        "registry",
        "activate-pack",
        "programming-artifact-ontology",
        "--store",
        "registry.sqlite",
      ]),
    ).toEqual({
      name: "ontology registry activate-pack",
      rest: ["programming-artifact-ontology", "--store", "registry.sqlite"],
    });
    expect(
      resolveSubcommand([
        "ontology",
        "snapshot",
        "ingest",
        "--input",
        "snapshot.json",
      ]),
    ).toEqual({
      name: "ontology snapshot ingest",
      rest: ["--input", "snapshot.json"],
    });
    expect(
      resolveSubcommand([
        "ontology",
        "corridor",
        "show-latest",
        "pipe-cli",
        "--scope",
        "pipe-scope",
      ]),
    ).toEqual({
      name: "ontology corridor show-latest",
      rest: ["pipe-cli", "--scope", "pipe-scope"],
    });
  });

  it("registry activate-pack activates a known pack through the local runtime", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-activate-"));
    try {
      const storePath = join(dir, "registry.sqlite");
      const output = await captureConsoleAsync(async () => {
        await cliOntology([
          "registry.activate-pack",
          "programming-artifact-ontology",
          "--store",
          storePath,
          "--ontology-id",
          "artifact-cli",
          "--namespace",
          "artifact_cli",
          "--owner",
          "cli-test",
          "--version",
          "v-test",
          "--address-model",
          "sum",
          "--prefix",
          "programming-artifact=artifact_cli_kind",
          "--json",
        ]);
      });
      const parsed = JSON.parse(output.stdout) as {
        status: string;
        packId: string;
        ontologyId: string;
        namespaceSummary: { namespace: string; owner?: string } | null;
        allocationSummaries: Array<{
          taxonomyId: string;
          prefix: string;
          versionId: string;
          addressModel: string;
          activationStatus?: string;
          syncStatus?: string;
        }>;
        smokeCheckSummary: {
          failedAllocationCount: number;
          failedCheckCount: number;
        };
        warnings: unknown[];
        errors: unknown[];
        syncSummariesByAllocationId: Record<string, unknown>;
      };

      expect(output.stderr).toBe("");
      expect(parsed).toMatchObject({
        status: "succeeded",
        packId: "programming-artifact-ontology",
        ontologyId: "artifact-cli",
        namespaceSummary: {
          namespace: "artifact_cli",
          owner: "cli-test",
        },
        warnings: [],
        errors: [],
      });
      expect(parsed.allocationSummaries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            taxonomyId: "programming-artifact",
            prefix: "artifact_cli_kind",
            versionId: "v-test",
            addressModel: "sum",
            activationStatus: "active",
            syncStatus: "synced",
          }),
        ]),
      );
      expect(parsed.smokeCheckSummary).toMatchObject({
        failedAllocationCount: 0,
        failedCheckCount: 0,
      });
      expect(Object.keys(parsed.syncSummariesByAllocationId).length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("registry activate-pack activates programming artifact ontology through the public command path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-command-activate-"));
    try {
      const storePath = join(dir, "registry.sqlite");
      const commandArgs = [
        "ontology",
        "registry",
        "activate-pack",
        "programming-artifact-ontology",
        "--store",
        storePath,
        "--json",
      ];
      const firstOutput = await captureConsoleWithExitCode(async () => {
        await main(commandArgs);
      });
      const first = JSON.parse(firstOutput.stdout) as RegistryActivationJson;

      expect(firstOutput.stderr).toBe("");
      expect(firstOutput.exitCode).toBeUndefined();
      expect(first).toMatchObject({
        status: "succeeded",
        packId: "programming-artifact-ontology",
        ontologyId: "programming-artifact-ontology",
        namespaceSummary: {
          ontologyId: "programming-artifact-ontology",
          namespace: "programming_artifact_ontology",
        },
        warnings: [],
        errors: [],
      });
      expect(first.allocationSummaries.map((summary) => summary.taxonomyId).sort()).toEqual([
        "programming-artifact",
        "programming-artifact-relation",
      ]);

      const firstAllocationIds = first.allocationSummaries
        .map((summary) => summary.allocationId)
        .sort();
      expect(Object.keys(first.syncSummariesByAllocationId).sort()).toEqual(
        firstAllocationIds,
      );
      expect(Object.keys(first.smokeCheckSummary.byAllocationId).sort()).toEqual(
        firstAllocationIds,
      );

      for (const allocation of first.allocationSummaries) {
        expect(allocation).toEqual(
          expect.objectContaining({
            ontologyId: "programming-artifact-ontology",
            versionId: "v1",
            addressModel: "product",
            status: "active",
            activationStatus: "active",
            syncStatus: "synced",
          }),
        );

        const syncSummary = first.syncSummariesByAllocationId[allocation.allocationId];
        expect(syncSummary).toEqual(
          expect.objectContaining({
            allocationId: allocation.allocationId,
            taxonomyId: allocation.taxonomyId,
            prefix: allocation.prefix,
            versionId: allocation.versionId,
            syncStatus: "synced",
            collisionCount: 0,
          }),
        );
        expect(syncSummary?.materializedRecordCount).toBeGreaterThan(0);
        expect(syncSummary?.targetRecordCount).toBeGreaterThan(0);

        const smokeSummary = first.smokeCheckSummary.byAllocationId[allocation.allocationId];
        expect(smokeSummary).toEqual(
          expect.objectContaining({
            allocationId: allocation.allocationId,
            taxonomyId: allocation.taxonomyId,
            prefix: allocation.prefix,
            versionId: allocation.versionId,
            syncStatus: "synced",
            passed: true,
            failedCheckCount: 0,
          }),
        );
        expect(smokeSummary?.checkCount).toBeGreaterThan(0);
      }
      expect(first.smokeCheckSummary).toMatchObject({
        allocationCount: 2,
        passedAllocationCount: 2,
        failedAllocationCount: 0,
        failedCheckCount: 0,
      });
      expect(first.smokeCheckSummary.passedCheckCount).toBe(
        first.smokeCheckSummary.checkCount,
      );

      const secondOutput = await captureConsoleWithExitCode(async () => {
        await main(commandArgs);
      });
      const second = JSON.parse(secondOutput.stdout) as RegistryActivationJson;

      expect(secondOutput.stderr).toBe("");
      expect(secondOutput.exitCode).toBe(1);
      expect(second).toMatchObject({
        status: "failed",
        packId: "programming-artifact-ontology",
        ontologyId: "programming-artifact-ontology",
        namespaceSummary: null,
        allocationSummaries: [],
        syncSummariesByAllocationId: {},
        smokeCheckSummary: { allocationCount: 0 },
        warnings: [],
        errors: [
          expect.objectContaining({
            level: "error",
            phase: "register",
            code: "duplicate-allocation",
          }),
        ],
      });
      expect(secondOutput.stdout).not.toMatch(/SQLITE|SqliteError|sqlite/i);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("registry activate-pack --json reports CLI errors with the activation error contract", async () => {
    const output = await captureConsoleWithExitCode(async () => {
      await cliOntology([
        "registry.activate-pack",
        "missing-pack",
        "--json",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      status: string;
      packId: string;
      ontologyId: string;
      namespaceSummary: null;
      allocationSummaries: unknown[];
      syncSummariesByAllocationId: Record<string, unknown>;
      smokeCheckSummary: { allocationCount: number };
      warnings: unknown[];
      errors: Array<{
        level: string;
        phase: string;
        code: string;
        packId: string;
        supportedPackIds: string[];
      }>;
    };

    expect(output.stderr).toBe("");
    expect(output.exitCode).toBe(1);
    expect(parsed).toMatchObject({
      status: "failed",
      packId: "missing-pack",
      ontologyId: "missing-pack",
      namespaceSummary: null,
      allocationSummaries: [],
      syncSummariesByAllocationId: {},
      smokeCheckSummary: { allocationCount: 0 },
      warnings: [],
      errors: [
        expect.objectContaining({
          level: "error",
          phase: "cli",
          code: "unknown-ontology-pack",
          packId: "missing-pack",
        }),
      ],
    });
    expect(parsed.errors[0]?.supportedPackIds).toEqual(KNOWN_ONTOLOGY_PACK_IDS);
  });

  it("registry activate-pack --json rejects invalid flags as structured JSON", async () => {
    const output = await captureConsoleWithExitCode(async () => {
      await cliOntology([
        "registry.activate-pack",
        "programming-artifact-ontology",
        "--not-a-real-flag",
        "value",
        "--json",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      status: string;
      packId: string;
      errors: Array<{ code: string; details?: { flag?: string } }>;
    };

    expect(output.stderr).toBe("");
    expect(output.exitCode).toBe(1);
    expect(parsed.status).toBe("failed");
    expect(parsed.packId).toBe("programming-artifact-ontology");
    expect(parsed.errors[0]).toMatchObject({
      code: "invalid-cli-flag",
      details: { flag: "--not-a-real-flag" },
    });
  });

  it("registry activate-pack emits helper failed results without wrapping them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-activate-failure-"));
    try {
      const storePath = join(dir, "registry.sqlite");
      await captureConsoleAsync(async () => {
        await cliOntology([
          "registry.activate-pack",
          "programming-artifact-ontology",
          "--store",
          storePath,
          "--ontology-id",
          "artifact-collision-a",
          "--namespace",
          "artifact_collision_a",
          "--version",
          "v-collision",
          "--prefix",
          "programming-artifact=artifact_collision",
          "--json",
        ]);
      });

      const output = await captureConsoleWithExitCode(async () => {
        await cliOntology([
          "registry.activate-pack",
          "programming-artifact-ontology",
          "--store",
          storePath,
          "--ontology-id",
          "artifact-collision-b",
          "--namespace",
          "artifact_collision_b",
          "--version",
          "v-collision",
          "--prefix",
          "programming-artifact=artifact_collision",
          "--json",
        ]);
      });
      const parsed = JSON.parse(output.stdout) as {
        status: string;
        packId: string;
        ontologyId: string;
        namespaceSummary: unknown;
        allocationSummaries: unknown[];
        syncSummariesByAllocationId: Record<string, unknown>;
        smokeCheckSummary: { allocationCount: number };
        warnings: unknown[];
        errors: Array<{ phase: string; code: string; message: string }>;
      };

      expect(output.stderr).toBe("");
      expect(output.exitCode).toBe(1);
      expect(parsed).toMatchObject({
        status: "failed",
        packId: "programming-artifact-ontology",
        ontologyId: "artifact-collision-b",
        namespaceSummary: null,
        allocationSummaries: [],
        syncSummariesByAllocationId: {},
        smokeCheckSummary: { allocationCount: 0 },
        warnings: [],
        errors: [
          expect.objectContaining({
            phase: "register",
            code: "duplicate-allocation",
          }),
        ],
      });
      expect(output.stdout).not.toMatch(/SQLITE|SqliteError|sqlite/i);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("registry activate-pack hides raw runtime storage errors in JSON output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-store-error-"));
    try {
      const output = await captureConsoleWithExitCode(async () => {
        await cliOntology([
          "registry.activate-pack",
          "programming-artifact-ontology",
          "--store",
          dir,
          "--json",
        ]);
      });
      const parsed = JSON.parse(output.stdout) as {
        status: string;
        errors: Array<{ code: string; message: string }>;
      };

      expect(output.exitCode).toBe(1);
      expect(parsed.status).toBe("failed");
      expect(parsed.errors[0]).toEqual(
        expect.objectContaining({
          code: "activation-runtime-error",
          message:
            "Ontology activation failed before a structured helper result was produced.",
        }),
      );
      expect(output.stdout).not.toMatch(/SQLITE|SqliteError|sqlite/i);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("registry activate-pack text output stays concise and includes action hints", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-activate-text-"));
    try {
      const storePath = join(dir, "registry.sqlite");
      const output = await captureConsoleAsync(async () => {
        await cliOntology([
          "registry.activate-pack",
          "programming-artifact-ontology",
          "--store",
          storePath,
          "--ontology-id",
          "artifact-text",
          "--namespace",
          "artifact_text",
          "--version",
          "v-text",
        ]);
      });

      expect(output.stderr).toBe("");
      expect(output.stdout).toContain("Ontology pack activation: programming-artifact-ontology");
      expect(output.stdout).toContain("status: succeeded");
      expect(output.stdout).toContain("allocations:");
      expect(output.stdout).toContain("smoke:");
      expect(output.stdout).toContain("action hints:");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("prompt extract-file can persist governance evidence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-prompt-"));
    const storePath = join(dir, "store.json");

    const first = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-file",
        "packages/operational-ontology/src/internal/checkpoint-core.ts",
        "--use-case",
        "feature_modification",
        "--kind",
        "code_editing_rules",
        "--store",
        storePath,
        "--quality-only",
      ]);
    });
    expect(first.stdout).toContain("actions: close_governance_evidence");

    const persisted = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-file",
        "packages/operational-ontology/src/internal/checkpoint-core.ts",
        "--use-case",
        "feature_modification",
        "--kind",
        "code_editing_rules",
        "--store",
        storePath,
        "--persist-governance",
        "--quality-only",
      ]);
    });
    expect(persisted.stdout).toContain("ontologyManagementRequired: false");
    expect(persisted.stdout).not.toContain("actions: close_governance_evidence");
  });

  it("prompt extract-artifact --json reports registry hits as structured source", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-hit-"));
    const registryPath = join(dir, "artifact-registry.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "build-dist-index",
            artifactRef: "dist/index.js",
            kind: "build",
            producedByRef: "pnpm --filter @qa-sdk/cli build",
            ownerDefinitionId: "programming-artifact-ontology-system",
            materializesOutputRefs: ["@qa-sdk/cli"],
            outputPath: "dist/index.js",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "dist/index.js",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        kind: string;
        registry: { status: string; providerId: string; recordCount: number };
        warnings: string[];
        governanceClosure: {
          status: string;
          matchedQualityStatusArtifactRefs: string[];
          warning?: { code: string; message: string; sourceRefs: string[] };
          recommendedManagementActions: Array<{ kind: string; plane: string }>;
        };
        qualitySignal: { code: string; grade: string };
      };
    };

    expect(parsed.source).toMatchObject({
      kind: "artifact-registry-hit",
      registry: {
        status: "hit",
        providerId: "programming-artifact-registry",
        recordCount: 1,
      },
      warnings: [],
      qualitySignal: {
        code: "artifact-registry-hit",
        grade: "ready",
      },
    });
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-missing",
      matchedQualityStatusArtifactRefs: [],
      warning: {
        code: "prompt-quality-status-evidence-missing",
      },
      recommendedManagementActions: [
        expect.objectContaining({
          kind: "close_governance_evidence",
          plane: "governance",
        }),
      ],
    });
    expect(parsed.source.governanceClosure.warning?.sourceRefs).toEqual(["dist/index.js"]);
  });

  it("prompt extract-artifact --json reports registry misses and search fallback", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-miss-"));
    const registryPath = join(dir, "artifact-registry.json");
    await writeFile(registryPath, JSON.stringify({ artifacts: [] }), "utf8");

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        kind: string;
        registry: { status: string; recordCount: number };
        fallback?: { kind: string; target: string };
        warnings: string[];
        recommendedManagementActions: string[];
        governanceClosure: {
          status: string;
          matchedQualityStatusArtifactRefs: string[];
          warning?: { code: string; message: string };
          recommendedManagementActions: Array<{ kind: string }>;
        };
        qualitySignal: {
          code: string;
          grade: string;
          warning?: string;
          recommendedManagementActions: string[];
        };
      };
    };

    expect(parsed.source).toMatchObject({
      kind: "artifact-search-fallback",
      registry: {
        status: "miss",
        recordCount: 0,
      },
      fallback: {
        kind: "search",
        target: "unmanaged-artifact",
      },
      recommendedManagementActions: ["create_programming_artifact_registry_record"],
      qualitySignal: {
        code: "artifact-search-fallback",
        grade: "degraded",
        recommendedManagementActions: ["create_programming_artifact_registry_record"],
      },
    });
    expect(parsed.source.qualitySignal.warning).toContain("free-string search");
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-missing",
      matchedQualityStatusArtifactRefs: [],
      warning: {
        code: "prompt-quality-status-evidence-missing",
      },
      recommendedManagementActions: [
        expect.objectContaining({
          kind: "close_governance_evidence",
        }),
      ],
    });
    expect(parsed.source.governanceClosure.warning?.message).not.toContain("free-string search");
    expect(parsed.source.warnings).toEqual([
      "artifact-registry-miss",
      "artifact-search-fallback",
    ]);
  }, 10_000);

  it("prompt extract-artifact preserves release verification use case through definition fallback", async () => {
    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "quality-gates-system",
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      useCase: string;
      source: { kind: string; fallback?: { kind: string; target: string } };
      artifacts: Array<{ artifact: { useCase?: string } }>;
    };

    expect(parsed.useCase).toBe("release_verification");
    expect(parsed.source).toMatchObject({
      kind: "artifact-definition-fallback",
      fallback: {
        kind: "definition",
        target: "quality-gates-system",
      },
    });
    expect(parsed.artifacts[0]!.artifact.useCase).toBe("release_verification");
  }, 10_000);

  it("prompt extract-artifact --json attaches related quality-status records on registry miss", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-"));
    const registryPath = join(dir, "artifact-registry.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-unmanaged-artifact",
            artifactRef: "artifacts/quality-status-unmanaged-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            materializesOutputRefs: ["artifact:unmanaged-artifact"],
            sourceRefs: ["packages/cli/src/commands/ontology.ts"],
            outputPath: "artifacts/quality-status-unmanaged-artifact.json",
            verificationRefs: ["packages/cli/src/commands/ontology.test.ts"],
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        kind: string;
        registry: { status: string; recordCount: number };
        fallback?: { kind: string; target: string };
        warnings: string[];
        qualityStatusRecords: {
          total: number;
          records: Array<{
            artifactId: string;
            artifactRef: string;
            matchRefs: string[];
            matchReasons: Array<{ field: string; ref: string }>;
          }>;
        };
        governanceClosure: {
          status: string;
          matchedQualityStatusArtifactRefs: string[];
          warning?: { code: string; message: string; sourceRefs: string[] };
          recommendedManagementActions: Array<{ kind: string; targetRefs: string[] }>;
        };
        qualitySignal: { warning?: string };
      };
      artifacts: Array<{
        artifact: {
          sourceRefs: string[];
        };
      }>;
    };

    expect(parsed.source).toMatchObject({
      kind: "artifact-search-fallback",
      registry: {
        status: "miss",
        recordCount: 1,
      },
      fallback: {
        kind: "search",
        target: "unmanaged-artifact",
      },
      warnings: [
        "artifact-registry-miss",
        "artifact-search-fallback",
        "quality-status-snapshot-missing",
        "quality-status-ledger-no-gate-descriptors",
      ],
      qualityStatusRecords: {
        total: 1,
        records: [
          expect.objectContaining({
            artifactId: "quality-status-unmanaged-artifact",
            artifactRef: "artifacts/quality-status-unmanaged-artifact.json",
            matchRefs: expect.arrayContaining([
              "unmanaged-artifact",
              "artifact:unmanaged-artifact",
            ]),
            qualityGateDescriptorWarning: expect.objectContaining({
              code: "quality-status-ledger-no-gate-descriptors",
            }),
          }),
        ],
      },
    });
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-incomplete",
      matchedQualityStatusArtifactRefs: ["artifacts/quality-status-unmanaged-artifact.json"],
      warning: {
        code: "prompt-quality-status-evidence-incomplete",
      },
      recommendedManagementActions: [
        expect.objectContaining({
          kind: "close_governance_evidence",
        }),
      ],
    });
    expect(parsed.source.governanceClosure.warning?.sourceRefs).toEqual(
      expect.arrayContaining([
        "quality-status:quality-status-unmanaged-artifact",
        "artifacts/quality-status-unmanaged-artifact.json",
      ]),
    );
    expect(parsed.source.qualitySignal.warning).toContain("free-string search");
    expect(parsed.source.governanceClosure.warning?.message).not.toContain("free-string search");
    expect(
      parsed.source.qualityStatusRecords.records[0]!.matchReasons.map((reason) => reason.field),
    ).toEqual(expect.arrayContaining(["verifiesRefs", "materializesOutputRefs"]));
    expect(parsed.artifacts[0]!.artifact.sourceRefs).toEqual(
      expect.arrayContaining([
        "governance-run:governance:artifact:quality-status-unmanaged-artifact:definition-context",
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact --json loads quality export snapshots from related quality-status records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-snapshot-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-unmanaged-artifact.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2026-04-13T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            title: "Work domain quality bundle",
            gateCount: 3,
            claimCount: 4,
            verifiedClaimCount: 3,
            bundleState: "verified",
            verifiedGates: 3,
            totalGates: 3,
            reviewScopes: [],
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-unmanaged-artifact",
            artifactRef: "quality-status-unmanaged-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "quality-status-unmanaged-artifact.json",
            verificationRefs: ["packages/cli/src/commands/ontology.test.ts"],
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        qualityStatusRecords: {
          warnings: Array<{ code: string }>;
          records: Array<{
            gateDescriptors?: Array<{
              gateDocId: string;
              docVersion: number;
              bundleId: string | null;
            }>;
            qualityExportSnapshot?: {
              rootId: string;
              bundleIds: string[];
              generatedAt?: string;
              sourcePath: string;
              totals: {
                verifiedGates: number;
                totalGates: number;
                claimCount: number;
                verifiedClaimCount: number;
              };
              bundles: Array<{
                bundleId: string;
                bundleState?: string;
                verifiedGates?: number;
                totalGates?: number;
                claimCount?: number;
                verifiedClaimCount?: number;
              }>;
            };
          }>;
        };
        governanceClosure: {
          status: string;
          matchedQualityStatusArtifactRefs: string[];
          warning?: { code: string };
          recommendedManagementActions: Array<{ kind: string }>;
        };
      };
      artifacts: Array<{
        artifact: {
          sourceRefs: string[];
        };
      }>;
    };

    expect(parsed.source.qualityStatusRecords.warnings).toEqual([]);
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-found",
      matchedQualityStatusArtifactRefs: ["quality-status-unmanaged-artifact.json"],
      recommendedManagementActions: [],
    });
    expect(parsed.source.governanceClosure.warning).toBeUndefined();
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityExportSnapshot).toMatchObject({
      rootId: "quality-gates-system",
      bundleIds: ["work-domain-quality-bundle"],
      generatedAt: "2026-04-13T00:00:00.000Z",
      sourcePath: snapshotPath,
      totals: {
        verifiedGates: 3,
        totalGates: 3,
        claimCount: 4,
        verifiedClaimCount: 3,
      },
      bundles: [
        {
          bundleId: "work-domain-quality-bundle",
          bundleState: "verified",
          verifiedGates: 3,
          totalGates: 3,
          claimCount: 4,
          verifiedClaimCount: 3,
        },
      ],
    });
    expect(parsed.source.qualityStatusRecords.records[0]!.gateDescriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateDocId: "gate-work-domain-typecheck",
          docVersion: expect.any(Number),
          bundleId: "work-domain-quality-bundle",
        }),
        expect.objectContaining({
          gateDocId: "gate-work-domain-build",
          docVersion: expect.any(Number),
          bundleId: "work-domain-quality-bundle",
        }),
        expect.objectContaining({
          gateDocId: "gate-work-domain-test",
          docVersion: expect.any(Number),
          bundleId: "work-domain-quality-bundle",
        }),
      ]),
    );
    expect(parsed.artifacts[0]!.artifact.sourceRefs).toEqual(
      expect.arrayContaining([
        "governance-run:governance:quality-status-unmanaged-artifact:quality-export-snapshot",
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact simulates a non-quality build artifact with a quality-status sidecar", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-build-sidecar-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-build-artifact.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2026-04-13T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            bundleState: "verified",
            verifiedGates: 3,
            totalGates: 3,
            claimCount: 4,
            verifiedClaimCount: 4,
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "build-cli-dist-index",
            artifactRef: "packages/cli/dist/index.js",
            kind: "build",
            producedByRef: "pnpm --filter @qa-sdk/cli build",
            ownerDefinitionId: "programming-artifact-ontology-cli",
            materializesOutputRefs: ["@qa-sdk/cli"],
            outputPath: "packages/cli/dist/index.js",
          },
          {
            artifactId: "quality-status-build-artifact",
            artifactRef: "quality-status-build-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["packages/cli/dist/index.js"],
            materializesOutputRefs: ["artifact:packages/cli/dist/index.js"],
            sourceRefs: ["packages/cli/src/commands/ontology.ts"],
            outputPath: "quality-status-build-artifact.json",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "packages/cli/dist/index.js",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        kind: string;
        registry: { status: string; recordCount: number };
        qualityStatusRecords: {
          total: number;
          records: Array<{
            artifactId: string;
            matchReasons: Array<{ field: string; ref: string }>;
            gateDescriptors?: Array<{ gateDocId: string; bundleId: string | null }>;
            qualityExportSnapshot?: {
              rootId: string;
              bundleIds: string[];
              totals: { verifiedGates: number; totalGates: number };
            };
          }>;
        };
        governanceClosure: {
          status: string;
          recommendedManagementActions: Array<{ kind: string }>;
        };
      };
      artifacts: Array<{
        quality: {
          metrics: Array<{ dimension: string; score: number }>;
          issues: Array<{ code: string }>;
        };
      }>;
    };
    const record = parsed.source.qualityStatusRecords.records[0]!;
    const governanceMetric = parsed.artifacts[0]!.quality.metrics.find(
      (metric) => metric.dimension === "governance_closure",
    );

    expect(parsed.source).toMatchObject({
      kind: "artifact-registry-hit",
      registry: {
        status: "hit",
        recordCount: 2,
      },
      qualityStatusRecords: {
        total: 1,
      },
      governanceClosure: {
        status: "quality-status-found",
        recommendedManagementActions: [],
      },
    });
    expect(record).toMatchObject({
      artifactId: "quality-status-build-artifact",
      qualityExportSnapshot: {
        rootId: "quality-gates-system",
        bundleIds: ["work-domain-quality-bundle"],
        totals: {
          verifiedGates: 3,
          totalGates: 3,
        },
      },
    });
    expect(record.matchReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "verifiesRefs",
          ref: "packages/cli/dist/index.js",
        }),
      ]),
    );
    expect(record.gateDescriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateDocId: "gate-work-domain-typecheck",
          bundleId: "work-domain-quality-bundle",
        }),
      ]),
    );
    expect(governanceMetric?.score).toBeGreaterThanOrEqual(85);
    expect(parsed.artifacts[0]!.quality.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-incomplete",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact rejects invalid quality-status max-age values", async () => {
    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--quality-status-max-age-days",
        "0",
        "--json",
      ]);
    });

    expect(output.stdout).toBe("");
    expect(output.stderr).toContain(
      'Invalid --quality-status-max-age-days value "0". Expected a positive integer number of days.',
    );
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("prompt extract-artifact leaves old generatedAt evidence unchanged when no max-age policy is provided", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-no-sla-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-old-artifact.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2000-01-01T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            bundleState: "verified",
            verifiedGates: 3,
            totalGates: 3,
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-old-artifact",
            artifactRef: "quality-status-old-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "quality-status-old-artifact.json",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: { status: string; warning?: { code: string } };
        qualityStatusRecords: {
          warnings: Array<{ code: string }>;
          records: Array<{
            qualityExportSnapshot?: { generatedAt?: string };
            qualityFreshness?: unknown;
          }>;
        };
      };
      artifacts: Array<{ quality: { issues: Array<{ code: string }> } }>;
    };

    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-found",
    });
    expect(parsed.source.governanceClosure.warning).toBeUndefined();
    expect(parsed.source.warnings).not.toContain("quality-status-generated-at-stale");
    expect(parsed.source.qualityStatusRecords.warnings).toEqual([]);
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityExportSnapshot).toMatchObject({
      generatedAt: "2000-01-01T00:00:00.000Z",
    });
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityFreshness).toBeUndefined();
    expect(parsed.artifacts[0]!.quality.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-stale",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact treats verified snapshots older than max-age as generatedAt freshness stale", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-snapshot-stale-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-stale-artifact.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2000-01-01T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            bundleState: "verified",
            verifiedGates: 3,
            totalGates: 3,
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-stale-artifact",
            artifactRef: "quality-status-stale-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "quality-status-stale-artifact.json",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-status-max-age-days",
        "1",
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: {
          status: string;
          warning?: { code: string; message: string };
        };
        qualityStatusRecords: {
          warnings: Array<{ code: string; message: string }>;
          records: Array<{
            qualityFreshness?: {
              status: string;
              source: string;
              generatedAt?: string;
              maxAgeDays: number;
            };
            qualityFreshnessWarning?: { code: string; message: string };
          }>;
        };
      };
      artifacts: Array<{ quality: { issues: Array<{ code: string; message: string }> } }>;
    };
    const record = parsed.source.qualityStatusRecords.records[0]!;

    expect(parsed.source.warnings).toContain("quality-status-generated-at-stale");
    expect(parsed.source.qualityStatusRecords.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quality-status-generated-at-stale",
        }),
      ]),
    );
    expect(record.qualityFreshness).toMatchObject({
      status: "stale",
      source: "snapshot-generated-at",
      generatedAt: "2000-01-01T00:00:00.000Z",
      maxAgeDays: 1,
    });
    expect(record.qualityFreshnessWarning).toMatchObject({
      code: "quality-status-generated-at-stale",
    });
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-invalid",
      warning: {
        code: "prompt-quality-status-evidence-stale",
      },
    });
    expect(parsed.source.governanceClosure.warning?.message).toContain("generatedAt freshness stale");
    expect(parsed.source.governanceClosure.warning?.message).toContain("not gate docVersion stale");
    expect(parsed.artifacts[0]!.quality.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-stale",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact keeps verified snapshots authoritative over ledger fallback", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-snapshot-primary-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-unmanaged-artifact.json");
    const ledgerPath = join(dir, "quality-ledger.sqlite");
    writeQualityLedgerRuns(ledgerPath, [
      { gateDocId: "gate-work-domain-typecheck", outcome: "fail" },
      { gateDocId: "gate-work-domain-build", outcome: "fail" },
      { gateDocId: "gate-work-domain-test", outcome: "fail" },
    ]);
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2026-04-13T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            bundleState: "verified",
            verifiedGates: 3,
            totalGates: 3,
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-unmanaged-artifact",
            artifactRef: "quality-status-unmanaged-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "quality-status-unmanaged-artifact.json",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        ledgerPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: {
          status: string;
          warning?: { code: string };
        };
        qualityStatusRecords: {
          records: Array<{
            qualityLedgerEvidence?: unknown;
            qualityLedgerConflictWarning?: { code: string };
          }>;
        };
      };
      artifacts: Array<{
        quality: {
          issues: Array<{ code: string }>;
        };
      }>;
    };

    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-found",
    });
    expect(parsed.source.governanceClosure.warning).toBeUndefined();
    expect(parsed.source.warnings).not.toContain("quality-status-ledger-conflict");
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityLedgerEvidence).toBeUndefined();
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityLedgerConflictWarning).toBeUndefined();
    expect(parsed.artifacts[0]!.quality.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-failed",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact uses ledger fallback when snapshot evidence is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-ledger-fallback-"));
    const registryPath = join(dir, "artifact-registry.json");
    const ledgerPath = join(dir, "quality-ledger.sqlite");
    writeQualityLedgerRuns(ledgerPath, [
      { gateDocId: "gate-work-domain-typecheck", outcome: "pass" },
      { gateDocId: "gate-work-domain-build", outcome: "pass" },
      { gateDocId: "gate-work-domain-test", outcome: "pass" },
    ]);
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-ledger-artifact",
            artifactRef: "quality-status-ledger-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        ledgerPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: {
          status: string;
          warning?: { code: string };
        };
        qualityStatusRecords: {
          records: Array<{
            qualityLedgerEvidence?: {
              sourcePath: string;
              ledgerPath: string;
              bundleId: string | null;
              bundleIds: string[];
              bundleRefs: string[];
              totalGates: number;
              totalGateCount: number;
              verifiedGates: number;
              verifiedGateCount: number;
              verified: boolean;
              gateRefs: string[];
              verifiedGateRefs: string[];
              blockingGates: Array<{ gateDocId: string; status: string }>;
              blockingGateStatuses: Array<{ gateDocId: string; status: string }>;
              latestRunTimestamps: string[];
              latestRunAt?: string;
              timestampSummary: {
                latestRunAt?: string;
                latestRunTimestamps: string[];
                latestRunCount: number;
                gatesWithRuns: number;
                gatesWithoutRuns: number;
              };
            };
          }>;
        };
      };
      artifacts: Array<{
        quality: {
          issues: Array<{ code: string }>;
        };
      }>;
    };
    const ledgerEvidence =
      parsed.source.qualityStatusRecords.records[0]!.qualityLedgerEvidence!;

    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-found",
    });
    expect(parsed.source.governanceClosure.warning).toBeUndefined();
    expect(parsed.source.warnings).not.toContain("quality-status-ledger-conflict");
    expect(ledgerEvidence).toMatchObject({
      sourcePath: ledgerPath,
      ledgerPath,
      bundleId: "work-domain-quality-bundle",
      bundleIds: ["work-domain-quality-bundle"],
      bundleRefs: ["work-domain-quality-bundle"],
      totalGates: 3,
      totalGateCount: 3,
      verifiedGates: 3,
      verifiedGateCount: 3,
      verified: true,
      gateRefs: expect.arrayContaining([
        "gate-work-domain-typecheck",
        "gate-work-domain-build",
        "gate-work-domain-test",
      ]),
      verifiedGateRefs: expect.arrayContaining([
        "gate-work-domain-typecheck",
        "gate-work-domain-build",
        "gate-work-domain-test",
      ]),
      blockingGates: [],
      blockingGateStatuses: [],
    });
    expect(ledgerEvidence.latestRunTimestamps.length).toBeGreaterThanOrEqual(1);
    expect(ledgerEvidence.latestRunAt).toBeDefined();
    expect(ledgerEvidence.timestampSummary).toMatchObject({
      latestRunAt: ledgerEvidence.latestRunAt,
      latestRunTimestamps: ledgerEvidence.latestRunTimestamps,
      latestRunCount: ledgerEvidence.latestRunTimestamps.length,
      gatesWithRuns: 3,
      gatesWithoutRuns: 0,
    });
    expect(parsed.artifacts[0]!.quality.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-incomplete",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact keeps closure open for mixed verified and incomplete quality-status evidence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-mixed-incomplete-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-verified-artifact.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2026-04-13T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            bundleState: "verified",
            verifiedGates: 3,
            totalGates: 3,
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-verified-artifact",
            artifactRef: "quality-status-verified-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "quality-status-verified-artifact.json",
          },
          {
            artifactId: "quality-status-incomplete-artifact",
            artifactRef: "quality-status-incomplete-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        governanceClosure: {
          status: string;
          warning?: { code: string };
          recommendedManagementActions: Array<{ kind: string }>;
        };
        qualityStatusRecords: {
          total: number;
        };
      };
      artifacts: Array<{
        quality: {
          metrics: Array<{ dimension: string; score: number }>;
          issues: Array<{ code: string }>;
        };
      }>;
    };
    const governanceMetric = parsed.artifacts[0]!.quality.metrics.find(
      (item) => item.dimension === "governance_closure",
    );

    expect(parsed.source.qualityStatusRecords.total).toBe(2);
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-incomplete",
      warning: {
        code: "prompt-quality-status-evidence-incomplete",
      },
      recommendedManagementActions: [
        expect.objectContaining({ kind: "close_governance_evidence" }),
      ],
    });
    expect(governanceMetric?.score).toBeLessThan(85);
    expect(parsed.artifacts[0]!.quality.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-incomplete",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact applies max-age to the oldest verified ledger gate timestamp", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-ledger-stale-"));
    const registryPath = join(dir, "artifact-registry.json");
    const ledgerPath = join(dir, "quality-ledger.sqlite");
    writeQualityLedgerRuns(ledgerPath, [
      {
        gateDocId: "gate-work-domain-typecheck",
        outcome: "pass",
        executedAt: "2000-01-01T00:00:00.000Z",
      },
      {
        gateDocId: "gate-work-domain-build",
        outcome: "pass",
        executedAt: new Date().toISOString(),
      },
      {
        gateDocId: "gate-work-domain-test",
        outcome: "pass",
        executedAt: new Date().toISOString(),
      },
    ]);
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-ledger-artifact",
            artifactRef: "quality-status-ledger-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        ledgerPath,
        "--quality-status-max-age-days",
        "1",
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: {
          status: string;
          warning?: { code: string; message: string };
        };
        qualityStatusRecords: {
          warnings: Array<{ code: string; resolvedPath?: string; message: string }>;
          records: Array<{
            qualityLedgerEvidence?: {
              verified: boolean;
              oldestVerifiedGateExecutedAt?: string;
              freshness?: {
                status: string;
                source: string;
                oldestVerifiedGateExecutedAt?: string;
                staleGateRefs?: string[];
              };
            };
            qualityFreshnessWarning?: { code: string };
          }>;
        };
      };
      artifacts: Array<{ quality: { issues: Array<{ code: string }> } }>;
    };
    const record = parsed.source.qualityStatusRecords.records[0]!;

    expect(parsed.source.warnings).toContain("quality-status-generated-at-stale");
    expect(parsed.source.qualityStatusRecords.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quality-status-generated-at-stale",
        }),
      ]),
    );
    expect(record.qualityLedgerEvidence).toMatchObject({
      verified: true,
      oldestVerifiedGateExecutedAt: "2000-01-01T00:00:00.000Z",
      freshness: {
        status: "stale",
        source: "ledger-verified-gate-executed-at",
        oldestVerifiedGateExecutedAt: "2000-01-01T00:00:00.000Z",
        staleGateRefs: ["gate-work-domain-typecheck"],
      },
    });
    expect(record.qualityFreshnessWarning).toMatchObject({
      code: "quality-status-generated-at-stale",
    });
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-invalid",
      warning: {
        code: "prompt-quality-status-evidence-stale",
      },
    });
    expect(parsed.source.governanceClosure.warning?.message).toContain("oldest verified gate");
    expect(parsed.artifacts[0]!.quality.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-stale",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact treats missing verified ledger timestamps as incomplete not stale", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-ledger-no-time-"));
    const registryPath = join(dir, "artifact-registry.json");
    const ledgerPath = join(dir, "quality-ledger.sqlite");
    writeQualityLedgerRuns(ledgerPath, [
      {
        gateDocId: "gate-work-domain-typecheck",
        outcome: "pass",
        executedAt: "not-a-date",
      },
      {
        gateDocId: "gate-work-domain-build",
        outcome: "pass",
        executedAt: new Date().toISOString(),
      },
      {
        gateDocId: "gate-work-domain-test",
        outcome: "pass",
        executedAt: new Date().toISOString(),
      },
    ]);
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-ledger-artifact",
            artifactRef: "quality-status-ledger-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        ledgerPath,
        "--quality-status-max-age-days",
        "1",
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: {
          status: string;
          warning?: { code: string; message: string };
        };
        qualityStatusRecords: {
          records: Array<{
            qualityLedgerEvidence?: {
              verified: boolean;
              freshness?: {
                status: string;
                missingTimestampGateRefs?: string[];
              };
            };
          }>;
        };
      };
      artifacts: Array<{ quality: { issues: Array<{ code: string }> } }>;
    };
    const ledgerEvidence =
      parsed.source.qualityStatusRecords.records[0]!.qualityLedgerEvidence!;

    expect(parsed.source.warnings).not.toContain("quality-status-generated-at-stale");
    expect(ledgerEvidence).toMatchObject({
      verified: true,
      freshness: {
        status: "incomplete",
        missingTimestampGateRefs: ["gate-work-domain-typecheck"],
      },
    });
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-incomplete",
      warning: {
        code: "prompt-quality-status-evidence-incomplete",
      },
    });
    expect(parsed.artifacts[0]!.quality.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-incomplete",
        }),
      ]),
    );
    expect(parsed.artifacts[0]!.quality.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-stale",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact reports incomplete ledger fallback evidence without new closure statuses", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-ledger-incomplete-"));
    const registryPath = join(dir, "artifact-registry.json");
    const ledgerPath = join(dir, "quality-ledger.sqlite");
    writeQualityLedgerRuns(ledgerPath, [
      { gateDocId: "gate-work-domain-typecheck", outcome: "pass" },
      { gateDocId: "gate-work-domain-build", outcome: "pass" },
    ]);
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-ledger-artifact",
            artifactRef: "quality-status-ledger-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        ledgerPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: {
          status: string;
          warning?: { code: string };
        };
        qualityStatusRecords: {
          warnings: Array<{ code: string; resolvedPath?: string; message: string }>;
          records: Array<{
            qualityLedgerEvidence?: {
              ledgerPath: string;
              bundleIds: string[];
              totalGateCount: number;
              verifiedGateCount: number;
              blockingGates: Array<{ gateDocId: string; status: string }>;
              timestampSummary: {
                latestRunCount: number;
                gatesWithRuns: number;
                gatesWithoutRuns: number;
              };
            };
            qualityLedgerIncompleteWarning?: { code: string; resolvedPath?: string };
          }>;
        };
      };
    };
    const record = parsed.source.qualityStatusRecords.records[0]!;

    expect(parsed.source.warnings).toContain("quality-status-ledger-incomplete");
    expect(parsed.source.qualityStatusRecords.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quality-status-ledger-incomplete",
          resolvedPath: ledgerPath,
        }),
      ]),
    );
    expect(record.qualityLedgerEvidence).toMatchObject({
      ledgerPath,
      bundleIds: ["work-domain-quality-bundle"],
      totalGateCount: 3,
      verifiedGateCount: 2,
      blockingGates: [
        expect.objectContaining({
          gateDocId: "gate-work-domain-test",
          status: "unverified",
        }),
      ],
      timestampSummary: {
        latestRunCount: expect.any(Number),
        gatesWithRuns: 2,
        gatesWithoutRuns: 1,
      },
    });
    expect(record.qualityLedgerIncompleteWarning).toMatchObject({
      code: "quality-status-ledger-incomplete",
      resolvedPath: ledgerPath,
    });
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-incomplete",
      warning: {
        code: "prompt-quality-status-evidence-incomplete",
      },
    });
  }, 10_000);

  it("prompt extract-artifact warns on determinate snapshot and ledger conflicts without overriding the snapshot", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-ledger-conflict-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-conflict-artifact.json");
    const ledgerPath = join(dir, "quality-ledger.sqlite");
    writeQualityLedgerRuns(ledgerPath, [
      { gateDocId: "gate-work-domain-typecheck", outcome: "pass" },
      { gateDocId: "gate-work-domain-build", outcome: "pass" },
      { gateDocId: "gate-work-domain-test", outcome: "pass" },
    ]);
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2026-04-13T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            bundleState: "failed",
            verifiedGates: 0,
            totalGates: 3,
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-conflict-artifact",
            artifactRef: "quality-status-conflict-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "quality-status-conflict-artifact.json",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        ledgerPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        governanceClosure: {
          status: string;
          warning?: { code: string; message: string };
        };
        qualityStatusRecords: {
          warnings: Array<{ code: string; resolvedPath?: string }>;
          records: Array<{
            qualityLedgerEvidence?: { verified: boolean };
            qualityLedgerConflictWarning?: { code: string; resolvedPath?: string };
          }>;
        };
      };
      artifacts: Array<{
        quality: {
          issues: Array<{ code: string }>;
        };
      }>;
    };

    expect(parsed.source.warnings).toContain("quality-status-ledger-conflict");
    expect(parsed.source.qualityStatusRecords.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quality-status-ledger-conflict",
          resolvedPath: ledgerPath,
        }),
      ]),
    );
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityLedgerEvidence).toMatchObject({
      verified: true,
    });
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityLedgerConflictWarning).toMatchObject({
      code: "quality-status-ledger-conflict",
      resolvedPath: ledgerPath,
    });
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-invalid",
      warning: {
        code: "prompt-quality-status-evidence-failed",
      },
    });
    expect(parsed.artifacts[0]!.quality.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-failed",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact --json resolves quality-status metadata, direct gate refs, and relations into descriptors", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-descriptors-"));
    const registryPath = join(dir, "artifact-registry.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-descriptor-artifact",
            artifactRef: "quality-status-descriptor-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            verificationRefs: ["gate-registry-test"],
            relations: [
              {
                kind: "materializes_output",
                fromRef: "quality-status-descriptor-artifact.json",
                toRef: "query-quality-bundle",
              },
            ],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        qualityStatusRecords: {
          records: Array<{
            gateDescriptors?: Array<{
              gateDocId: string;
              docVersion: number;
              bundleId: string | null;
            }>;
            qualityGateDescriptorWarning?: { code: string };
          }>;
        };
      };
      artifacts: Array<{
        quality: {
          issues: Array<{ sourceRefs?: string[] }>;
        };
      }>;
    };
    const record = parsed.source.qualityStatusRecords.records[0]!;

    expect(parsed.source.warnings).not.toContain("quality-status-ledger-no-gate-descriptors");
    expect(record.qualityGateDescriptorWarning).toBeUndefined();
    expect(record.gateDescriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateDocId: "gate-work-domain-typecheck",
          docVersion: expect.any(Number),
          bundleId: "work-domain-quality-bundle",
        }),
        expect.objectContaining({
          gateDocId: "gate-registry-test",
          docVersion: expect.any(Number),
          bundleId: null,
        }),
        expect.objectContaining({
          gateDocId: "gate-query-test",
          docVersion: expect.any(Number),
          bundleId: "query-quality-bundle",
        }),
      ]),
    );
    expect(record.gateDescriptors?.map((descriptor) => descriptor.gateDocId)).not.toEqual(
      expect.arrayContaining([
        "gate-decision-flow-build",
        "gate-decode-build",
        "gate-definition-service-build",
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact --json warns without crashing for missing quality ledger input", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-ledger-missing-"));
    const registryPath = join(dir, "artifact-registry.json");
    const missingLedgerPath = join(dir, "missing-quality-ledger.sqlite");
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-ledger-artifact",
            artifactRef: "quality-status-ledger-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        missingLedgerPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        qualityStatusRecords: {
          warnings: Array<{ code: string; resolvedPath?: string; message: string }>;
          records: Array<{
            qualityLedgerWarning?: { code: string; resolvedPath?: string; message: string };
          }>;
        };
      };
      artifacts: unknown[];
    };

    expect(parsed.artifacts).toHaveLength(1);
    expect(parsed.source.warnings).toEqual(
      expect.arrayContaining(["quality-status-ledger-missing"]),
    );
    expect(parsed.source.qualityStatusRecords.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quality-status-ledger-missing",
          resolvedPath: missingLedgerPath,
        }),
      ]),
    );
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityLedgerWarning).toMatchObject({
      code: "quality-status-ledger-missing",
      resolvedPath: missingLedgerPath,
    });
  }, 10_000);

  it("prompt extract-artifact --json warns without crashing for corrupt quality ledger input", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-ledger-corrupt-"));
    const registryPath = join(dir, "artifact-registry.json");
    const corruptLedgerPath = join(dir, "corrupt-quality-ledger.sqlite");
    await writeFile(corruptLedgerPath, "not a sqlite database", "utf8");
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-ledger-artifact",
            artifactRef: "quality-status-ledger-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        corruptLedgerPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        qualityStatusRecords: {
          warnings: Array<{ code: string; resolvedPath?: string; cause?: string }>;
          records: Array<{
            qualityLedgerWarning?: { code: string; resolvedPath?: string; cause?: string };
          }>;
        };
      };
      artifacts: unknown[];
    };

    expect(parsed.artifacts).toHaveLength(1);
    expect(parsed.source.warnings).toEqual(
      expect.arrayContaining(["quality-status-ledger-read-failed"]),
    );
    expect(parsed.source.qualityStatusRecords.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quality-status-ledger-read-failed",
          resolvedPath: corruptLedgerPath,
        }),
      ]),
    );
    expect(parsed.source.qualityStatusRecords.records[0]!.qualityLedgerWarning).toMatchObject({
      code: "quality-status-ledger-read-failed",
      resolvedPath: corruptLedgerPath,
    });
  }, 10_000);

  it("non-artifact prompt extraction ignores quality ledger input", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-non-artifact-quality-ledger-"));
    const registryPath = join(dir, "artifact-registry.json");
    const missingLedgerPath = join(dir, "missing-quality-ledger.sqlite");
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-quality-gates-system",
            artifactRef: "quality-status-quality-gates-system.json",
            kind: "quality-status",
            verifiesRefs: ["quality-gates-system"],
            metadata: {
              rootId: "quality-gates-system",
              bundles: [
                {
                  bundleId: "work-domain-quality-bundle",
                },
              ],
            },
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract",
        "quality-gates-system",
        "--artifact-registry",
        registryPath,
        "--quality-ledger",
        missingLedgerPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });

    expect(output.stdout).not.toContain("quality-status-ledger-missing");
    expect(output.stdout).not.toContain("quality-status-ledger-read-failed");
  }, 10_000);

  it("prompt extract-artifact treats partially verified snapshots as incomplete not failed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-partial-"));
    const registryPath = join(dir, "artifact-registry.json");
    const snapshotPath = join(dir, "quality-status-partial-artifact.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        rootId: "quality-gates-system",
        generatedAt: "2026-04-13T00:00:00.000Z",
        bundles: [
          {
            bundleId: "work-domain-quality-bundle",
            bundleState: "gate-bound",
            verifiedGates: 1,
            totalGates: 3,
            claimCount: 4,
            verifiedClaimCount: 1,
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-partial-artifact",
            artifactRef: "quality-status-partial-artifact.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "quality-status-partial-artifact.json",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        governanceClosure: {
          status: string;
          warning?: { code: string; message: string };
        };
      };
      artifacts: Array<{
        quality: {
          issues: Array<{ code: string }>;
        };
      }>;
    };

    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-incomplete",
      warning: {
        code: "prompt-quality-status-evidence-incomplete",
      },
    });
    expect(parsed.source.governanceClosure.warning?.message).not.toContain("failed");
    expect(parsed.artifacts[0]!.quality.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-incomplete",
        }),
      ]),
    );
    expect(parsed.artifacts[0]!.quality.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-failed",
        }),
      ]),
    );
  }, 10_000);

  it("prompt extract-artifact --json warns for missing or invalid quality export snapshots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-artifact-quality-warning-"));
    const registryPath = join(dir, "artifact-registry.json");
    const invalidPath = join(dir, "invalid-quality-status.json");
    await writeFile(invalidPath, "{not-json", "utf8");
    await writeFile(
      registryPath,
      JSON.stringify({
        artifacts: [
          {
            artifactId: "quality-status-missing",
            artifactRef: "missing-quality-status.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "missing-quality-status.json",
          },
          {
            artifactId: "quality-status-invalid",
            artifactRef: "invalid-quality-status.json",
            kind: "quality-status",
            verifiesRefs: ["unmanaged-artifact"],
            outputPath: "invalid-quality-status.json",
          },
        ],
      }),
      "utf8",
    );

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      source: {
        warnings: string[];
        qualityStatusRecords: {
          total: number;
          warnings: Array<{
            code: string;
            artifactId: string;
            outputPath?: string;
            message: string;
          }>;
          records: Array<{
            artifactId: string;
            qualityExportWarning?: { code: string };
          }>;
        };
        governanceClosure: {
          status: string;
          matchedQualityStatusArtifactRefs: string[];
          warning?: { code: string; message: string; sourceRefs: string[] };
          recommendedManagementActions: Array<{ kind: string }>;
        };
        qualitySignal: { warning?: string };
      };
      artifacts: unknown[];
    };

    expect(parsed.artifacts).toHaveLength(1);
    expect(parsed.source.qualityStatusRecords.total).toBe(2);
    expect(parsed.source.warnings).toEqual(
      expect.arrayContaining([
        "quality-status-snapshot-missing",
        "quality-status-snapshot-invalid-json",
      ]),
    );
    expect(parsed.source.qualityStatusRecords.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quality-status-snapshot-missing",
          artifactId: "quality-status-missing",
          outputPath: "missing-quality-status.json",
        }),
        expect.objectContaining({
          code: "quality-status-snapshot-invalid-json",
          artifactId: "quality-status-invalid",
          outputPath: "invalid-quality-status.json",
        }),
      ]),
    );
    expect(parsed.source.qualityStatusRecords.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactId: "quality-status-missing",
          qualityExportWarning: expect.objectContaining({
            code: "quality-status-snapshot-missing",
          }),
        }),
        expect.objectContaining({
          artifactId: "quality-status-invalid",
          qualityExportWarning: expect.objectContaining({
            code: "quality-status-snapshot-invalid-json",
          }),
        }),
      ]),
    );
    expect(parsed.source.governanceClosure).toMatchObject({
      status: "quality-status-invalid",
      matchedQualityStatusArtifactRefs: [
        "missing-quality-status.json",
        "invalid-quality-status.json",
      ],
      warning: {
        code: "prompt-quality-status-evidence-invalid",
      },
      recommendedManagementActions: [
        expect.objectContaining({
          kind: "close_governance_evidence",
        }),
      ],
    });
    expect(parsed.source.qualitySignal.warning).toContain("free-string search");
    expect(parsed.source.governanceClosure.warning?.message).not.toContain("free-string search");
  }, 10_000);

  it("prompt extract-artifact materializes prompt artifacts and appends registry records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-prompt-output-"));
    const outputPath = join(dir, "self-reflection.md");
    const registryPath = join(dir, "programming-artifacts.json");

    const output = await captureConsoleAsync(async () => {
      await cliOntology([
        "prompt.extract-artifact",
        "unmanaged-artifact",
        "--artifact-registry",
        registryPath,
        "--output",
        outputPath,
        "--kind",
        "self_reflection",
        "--json",
        "--scan",
      ]);
    });
    const parsed = JSON.parse(output.stdout) as {
      outputs: Array<{ artifactId: string; kind: string; outputPath: string }>;
    };
    const promptContent = await readFile(outputPath, "utf8");
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      artifacts: Array<{
        kind: string;
        artifactRef: string;
        outputPath: string;
        producedByRef?: string;
        materializesOutputRefs?: string[];
      }>;
    };

    expect(parsed.outputs).toEqual([
      {
        artifactId: "prompt-artifact:artifact:unmanaged-artifact:self_reflection",
        kind: "self_reflection",
        outputPath,
      },
    ]);
    expect(promptContent).toContain("<self_reflection>");
    expect(registry.artifacts).toHaveLength(1);
    expect(registry.artifacts[0]).toMatchObject({
      kind: "prompt-artifact",
      artifactRef: outputPath,
      outputPath,
      producedByRef: "qa-sdk ontology prompt extract-artifact unmanaged-artifact",
    });
    expect(registry.artifacts[0]!.materializesOutputRefs).toEqual(
      expect.arrayContaining([
        "prompt-artifact:artifact:unmanaged-artifact:self_reflection",
        "work-area:artifact:unmanaged-artifact",
        "unmanaged-artifact",
      ]),
    );
  }, 10_000);

  it("artifact registry append/list/validate supports build records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-registry-cli-"));
    const registryPath = join(dir, "programming-artifacts.json");

    const appendOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "artifact.registry.append",
        "--output",
        registryPath,
        "--kind",
        "build",
        "--artifact-ref",
        "packages/cli/dist/index.js",
        "--produced-by",
        "pnpm --filter @qa-sdk/cli build",
        "--derived-from",
        "packages/cli/src/index.ts,packages/cli/package.json",
        "--owner-definition",
        "programming-artifact-ontology-cli",
        "--materializes-output",
        "@qa-sdk/cli",
        "--json",
      ]);
    });
    const append = JSON.parse(appendOutput.stdout) as {
      record: { kind: string; artifactRef: string; producedByRef?: string };
      recordCount: number;
    };

    expect(append.record).toMatchObject({
      kind: "build",
      artifactRef: "packages/cli/dist/index.js",
      producedByRef: "pnpm --filter @qa-sdk/cli build",
    });
    expect(append.recordCount).toBe(1);

    const listOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "artifact.registry.list",
        "--input",
        registryPath,
        "--kind",
        "build",
        "--json",
      ]);
    });
    const listed = JSON.parse(listOutput.stdout) as {
      artifacts: Array<{ kind: string; artifactRef: string }>;
    };
    expect(listed.artifacts).toEqual([
      expect.objectContaining({
        kind: "build",
        artifactRef: "packages/cli/dist/index.js",
      }),
    ]);

    const validateOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "artifact.registry.validate",
        "--input",
        registryPath,
        "--json",
      ]);
    });
    const validation = JSON.parse(validateOutput.stdout) as {
      valid: boolean;
      artifactCount: number;
      errors: unknown[];
    };
    expect(validation).toMatchObject({
      valid: true,
      artifactCount: 1,
      errors: [],
    });
  });

  it("event ingest 후 snapshot list/show를 수행한다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-event-"));
    const storePath = join(dir, "store.json");
    const inputPath = join(dir, "event.json");

    await writeFile(
      inputPath,
      JSON.stringify(
        {
          record: {
            log_id: "log-cli",
            timestamp: "2026-04-10T00:00:00.000Z",
            record_kind: "log",
            trace_id: "trace-cli",
            span_id: "span-cli",
            event_key: "order.submit",
            event_version: "v1",
            payload_format: "json",
            payload_encoding: "identity",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { orderId: "ord-cli" },
            address_context: {},
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const ingestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "event.ingest",
        "--input",
        inputPath,
        "--store",
        storePath,
        "--snapshot-id",
        "snapshot:event-cli",
        "--scope",
        "event-scope",
      ]);
    });
    expect(ingestOutput.stdout).toContain("Event snapshot ingested: snapshot:event-cli");

    const listOutput = await captureConsoleAsync(async () => {
      await cliOntology(["snapshot.list", "--store", storePath]);
    });
    expect(listOutput.stdout).toContain("snapshot:event-cli");

    const showOutput = await captureConsoleAsync(async () => {
      await cliOntology(["snapshot.show", "snapshot:event-cli", "--store", storePath]);
    });
    expect(showOutput.stdout).toContain("Snapshot: snapshot:event-cli");
    expect(showOutput.stdout).toContain("corridors: 1");

    const checkpointListOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "checkpoint.list",
        "--scope",
        "event-scope",
        "--store",
        storePath,
      ]);
    });
    expect(checkpointListOutput.stdout).toContain("checkpoint:event-record:log-cli");

    const checkpointShowOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "checkpoint.show",
        "checkpoint:event-record:log-cli",
        "--scope",
        "event-scope",
        "--store",
        storePath,
      ]);
    });
    expect(checkpointShowOutput.stdout).toContain(
      "Checkpoint lattice: checkpoint:event-record:log-cli",
    );

    const checkpointDiffOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "checkpoint.diff-latest",
        "checkpoint:event-record:log-cli",
        "--scope",
        "event-scope",
        "--store",
        storePath,
      ]);
    });
    expect(checkpointDiffOutput.stderr).toContain("Checkpoint diff-latest 없음");

    const statusOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "status",
        "--scope",
        "event-scope",
        "--store",
        storePath,
      ]);
    });
    expect(statusOutput.stdout).toContain("Ontology status: event-scope");
    expect(statusOutput.stdout).toContain("snapshots: 1");

    const statusTableOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "status",
        "--scope",
        "event-scope",
        "--store",
        storePath,
        "--table",
      ]);
    });
    expect(statusTableOutput.stdout).toContain("scope");
    expect(statusTableOutput.stdout).toContain("event-scope");

    const snapshotStatusOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "status",
        "--snapshot",
        "snapshot:event-cli",
        "--store",
        storePath,
      ]);
    });
    expect(snapshotStatusOutput.stdout).toContain("Ontology status: event-scope");
    expect(snapshotStatusOutput.stdout).toContain("snapshot: snapshot:event-cli");
  });

  it("pipe ingest 후 corridor show를 수행한다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-pipe-"));
    const storePath = join(dir, "store.json");
    const inputPath = join(dir, "pipe.json");

    await writeFile(
      inputPath,
      JSON.stringify(
        {
          graph: {
            graphId: "pipe-cli",
            version: "v1",
            entryPipeId: "collect-order",
            pipes: [
              {
                pipeId: "collect-order",
                version: "v1",
                trigger: { eventKey: "order.submit" },
                flow: { kind: "step", facet: "produced" },
              },
              {
                pipeId: "persist-order",
                version: "v1",
                trigger: { eventKey: "order.created" },
                flow: { kind: "step", facet: "consumed" },
              },
            ],
            connections: [
              {
                from: "collect-order",
                to: "persist-order",
                kind: "conditional",
                condition: "order.valid == true",
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const ingestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "pipe.ingest",
        "--input",
        inputPath,
        "--store",
        storePath,
        "--snapshot-id",
        "snapshot:pipe-cli",
        "--scope",
        "pipe-scope",
      ]);
    });
    expect(ingestOutput.stdout).toContain("Pipe snapshot ingested: snapshot:pipe-cli");

    const corridorOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "corridor.show",
        "pipe-cli",
        "--snapshot",
        "snapshot:pipe-cli",
        "--store",
        storePath,
      ]);
    });
    expect(corridorOutput.stdout).toContain("Corridor: pipe-cli");
    expect(corridorOutput.stdout).toContain("controlFlow: pipe-cli");

    const corridorListOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "corridor.list",
        "--scope",
        "pipe-scope",
        "--store",
        storePath,
      ]);
    });
    expect(corridorListOutput.stdout).toContain("pipe-cli");

    const corridorLatestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "corridor.show-latest",
        "pipe-cli",
        "--scope",
        "pipe-scope",
        "--store",
        storePath,
      ]);
    });
    expect(corridorLatestOutput.stdout).toContain("Corridor: pipe-cli");
    expect(corridorLatestOutput.stdout).toContain("snapshot: snapshot:pipe-cli");

    const junctionListOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "junction.list",
        "--scope",
        "pipe-scope",
        "--store",
        storePath,
      ]);
    });
    expect(junctionListOutput.stdout).toContain("collect-order");

    const junctionShowOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "junction.show",
        "collect-order",
        "--scope",
        "pipe-scope",
        "--store",
        storePath,
      ]);
    });
    expect(junctionShowOutput.stdout).toContain("Junction: collect-order");
    expect(junctionShowOutput.stdout).toContain("mode: first_match");

    const routeListOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "route.list",
        "--scope",
        "pipe-scope",
        "--store",
        storePath,
      ]);
    });
    expect(routeListOutput.stdout).toContain("Route decision 없음");
  });

  it("snapshot ingest 후 route/traversal/junction 조회를 수행한다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-ontology-snapshot-"));
    const storePath = join(dir, "store.json");
    const inputPath = join(dir, "snapshot.json");

    await writeFile(
      inputPath,
      JSON.stringify(
        {
          graph: {
            graphId: "snapshot-cli",
            version: "v1",
            entryPipeId: "collect-order",
            pipes: [
              {
                pipeId: "collect-order",
                version: "v1",
                trigger: { eventKey: "order.submit" },
                flow: { kind: "step", facet: "produced" },
              },
              {
                pipeId: "validate-order",
                version: "v1",
                trigger: { eventKey: "order.created" },
                flow: { kind: "step", facet: "consumed" },
              },
            ],
            connections: [
              {
                from: "collect-order",
                to: "validate-order",
                kind: "conditional",
                condition: "order.valid == true",
              },
            ],
          },
          pathObservation: {
            reached_nodes: [
              {
                spec_step_id: "collect-order",
                runtime_node_id: "run-1",
                event_key: "order.submit",
                timestamp: "2026-04-10T00:03:00.000Z",
              },
              {
                spec_step_id: "validate-order",
                runtime_node_id: "run-2",
                event_key: "order.created",
                timestamp: "2026-04-10T00:03:01.000Z",
              },
            ],
            traversed_edges: [
              {
                from_step_id: "collect-order",
                to_step_id: "validate-order",
                edge_type: "branch",
              },
            ],
            reached_goals: ["validate-order"],
            unreachable_goals: [],
            loop_detected: false,
            recovery_used: false,
            terminal_node: "run-2",
            terminal_reason: "goal_reached",
            branchPoints: [
              {
                sourceStepId: "collect-order",
                branches: [
                  {
                    targetStepId: "validate-order",
                    edgeType: "branch",
                    taken: true,
                    reachedNodes: [],
                  },
                ],
              },
            ],
            branchCoverage: { taken: 1, total: 1, rate: 1 },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await captureConsoleAsync(async () => {
      await cliOntology([
        "snapshot.ingest",
        "--input",
        inputPath,
        "--store",
        storePath,
        "--snapshot-id",
        "snapshot:rich-cli",
        "--scope",
        "snapshot-scope",
      ]);
    });

    await writeFile(
      inputPath,
      JSON.stringify(
        {
          graph: {
            graphId: "snapshot-cli",
            version: "v2",
            entryPipeId: "collect-order",
            pipes: [
              {
                pipeId: "collect-order",
                version: "v2",
                trigger: { eventKey: "order.submit" },
                flow: { kind: "step", facet: "produced" },
                ports: [{ portId: "out", direction: "out", facetType: "produced" }],
              },
              {
                pipeId: "validate-order",
                version: "v2",
                trigger: { eventKey: "order.created" },
                flow: { kind: "step", facet: "consumed" },
                ports: [{ portId: "in", direction: "in", facetType: "consumed" }],
              },
            ],
            connections: [
              {
                from: { pipeId: "collect-order", portId: "out" },
                to: { pipeId: "validate-order", portId: "in" },
                kind: "next",
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await captureConsoleAsync(async () => {
      await cliOntology([
        "snapshot.ingest",
        "--input",
        inputPath,
        "--store",
        storePath,
        "--snapshot-id",
        "snapshot:rich-cli-2",
        "--scope",
        "snapshot-scope",
      ]);
    });

    const junctionListOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "junction.list",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(junctionListOutput.stdout).toContain("collect-order");

    const junctionShowOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "junction.show",
        "collect-order",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(junctionShowOutput.stdout).toContain("Junction: collect-order");

    const routeShowOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "route.show",
        "collect-order",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(routeShowOutput.stdout).toContain("Route decision: collect-order");

    const routeDiffLatestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "route.diff-latest",
        "collect-order",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(routeDiffLatestOutput.stdout).toContain(
      "Route diff-latest: collect-order",
    );

    const traversalListOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "traversal.list",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(traversalListOutput.stdout).toContain("traversal:observe:collect-order");

    const traversalKey =
      "traversal:observe:collect-order->edge:collect-order->path:branch->validate-order->validate-order";
    const traversalShowOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "traversal.show",
        traversalKey,
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(traversalShowOutput.stdout).toContain(`Traversal: ${traversalKey}`);

    const traversalDiffLatestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "traversal.diff-latest",
        traversalKey,
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(traversalDiffLatestOutput.stdout).toContain(
      `Traversal diff-latest: ${traversalKey}`,
    );

    const snapshotDiffOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "snapshot.diff",
        "snapshot:rich-cli",
        "snapshot:rich-cli-2",
        "--store",
        storePath,
      ]);
    });
    expect(snapshotDiffOutput.stdout).toContain(
      "Snapshot diff: snapshot:rich-cli -> snapshot:rich-cli-2",
    );

    const snapshotDiffLatestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "snapshot.diff-latest",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(snapshotDiffLatestOutput.stdout).toContain(
      "Snapshot diff-latest: snapshot-scope",
    );

    const corridorDiffOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "corridor.diff",
        "snapshot-cli",
        "--from",
        "snapshot:rich-cli",
        "--to",
        "snapshot:rich-cli-2",
        "--store",
        storePath,
      ]);
    });
    expect(corridorDiffOutput.stdout).toContain("Corridor diff: snapshot-cli");

    const corridorDiffLatestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "corridor.diff-latest",
        "snapshot-cli",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(corridorDiffLatestOutput.stdout).toContain(
      "Corridor diff-latest: snapshot-cli",
    );

    const junctionDiffLatestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "junction.diff-latest",
        "collect-order",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(junctionDiffLatestOutput.stdout).toContain(
      "Junction diff-latest: collect-order",
    );

    const checkpointDiffLatestOutput = await captureConsoleAsync(async () => {
      await cliOntology([
        "checkpoint.diff-latest",
        "checkpoint:event-record:log-cli",
        "--scope",
        "snapshot-scope",
        "--store",
        storePath,
      ]);
    });
    expect(checkpointDiffLatestOutput.stderr).toContain(
      "Checkpoint diff-latest 없음: checkpoint:event-record:log-cli @ snapshot-scope",
    );
  });
});

interface RegistryActivationJson {
  status: string;
  packId: string | null;
  ontologyId: string | null;
  namespaceSummary: {
    ontologyId: string;
    namespace: string;
    owner?: string;
  } | null;
  allocationSummaries: Array<{
    allocationId: string;
    ontologyId: string;
    taxonomyId: string;
    prefix: string;
    versionId: string;
    addressModel: string;
    status: string;
    activationStatus?: string;
    syncStatus?: string;
  }>;
  syncSummariesByAllocationId: Record<string, {
    allocationId: string;
    taxonomyId: string;
    prefix: string;
    versionId: string;
    syncStatus: string;
    materializedRecordCount: number;
    collisionCount: number;
    targetRecordCount: number;
  }>;
  smokeCheckSummary: {
    allocationCount: number;
    passedAllocationCount: number;
    failedAllocationCount: number;
    checkCount: number;
    passedCheckCount: number;
    failedCheckCount: number;
    byAllocationId: Record<string, {
      allocationId: string;
      taxonomyId: string;
      prefix: string;
      versionId: string;
      syncStatus: string;
      passed: boolean;
      checkCount: number;
      failedCheckCount: number;
    }>;
  };
  warnings: unknown[];
  errors: Array<{
    level?: string;
    phase?: string;
    code?: string;
  }>;
}

async function captureConsoleAsync(run: () => Promise<void>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}

async function captureConsoleWithExitCode(run: () => Promise<void>) {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    const output = await captureConsoleAsync(run);
    return {
      ...output,
      exitCode: process.exitCode,
    };
  } finally {
    process.exitCode = previousExitCode;
  }
}

function writeQualityLedgerRuns(
  ledgerPath: string,
  runs: readonly {
    gateDocId: string;
    outcome: "pass" | "fail";
    docVersion?: number;
    bundleId?: string;
    executedAt?: string;
  }[],
): void {
  const store = new SqliteQualityStore(ledgerPath);
  try {
    for (const run of runs) {
      store.insert({
        gateDocId: run.gateDocId,
        docVersion: run.docVersion ?? 1,
        bundleId: run.bundleId ?? "work-domain-quality-bundle",
        command: "pnpm test",
        outcome: run.outcome,
        exitCode: run.outcome === "pass" ? 0 : 1,
        executedAt: run.executedAt ?? new Date().toISOString(),
      });
    }
  } finally {
    store.close();
  }
}
