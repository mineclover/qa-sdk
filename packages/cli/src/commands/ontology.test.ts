import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { cliOntology } from "./ontology.js";
import { USAGE, resolveSubcommand } from "../index.js";

describe("ontology CLI", () => {
  it("usage와 subcommand 해석에 ontology 루트를 노출한다", () => {
    expect(USAGE).toContain("qa-sdk ontology status");
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
