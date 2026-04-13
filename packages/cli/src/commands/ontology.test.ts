import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { cliOntology } from "./ontology.js";
import { USAGE, resolveSubcommand } from "../index.js";

describe("ontology CLI", () => {
  it("usage와 subcommand 해석에 ontology 루트를 노출한다", () => {
    expect(USAGE).toContain("qa-sdk ontology status");
    expect(USAGE).toContain("qa-sdk ontology prompt extract");
    expect(USAGE).toContain("qa-sdk ontology prompt extract-file");
    expect(USAGE).toContain("qa-sdk ontology prompt extract-permission");
    expect(USAGE).toContain("qa-sdk ontology prompt extract-artifact");
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
        rootId: "programming-artifact-ontology-system",
        generatedAt: "2026-04-13T00:00:00.000Z",
        bundles: [
          {
            bundleId: "programming-artifact-ontology-provider",
            title: "Programming artifact ontology provider",
            gateCount: 2,
            claimCount: 4,
            verifiedClaimCount: 3,
            bundleState: "verified",
            verifiedGates: 2,
            totalGates: 2,
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
      rootId: "programming-artifact-ontology-system",
      bundleIds: ["programming-artifact-ontology-provider"],
      generatedAt: "2026-04-13T00:00:00.000Z",
      sourcePath: snapshotPath,
      totals: {
        verifiedGates: 2,
        totalGates: 2,
        claimCount: 4,
        verifiedClaimCount: 3,
      },
      bundles: [
        {
          bundleId: "programming-artifact-ontology-provider",
          bundleState: "verified",
          verifiedGates: 2,
          totalGates: 2,
          claimCount: 4,
          verifiedClaimCount: 3,
        },
      ],
    });
    expect(parsed.artifacts[0]!.artifact.sourceRefs).toEqual(
      expect.arrayContaining([
        "governance-run:governance:quality-status-unmanaged-artifact:quality-export-snapshot",
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
