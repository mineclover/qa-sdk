import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { cliOntology } from "./ontology.js";
import { USAGE, resolveSubcommand } from "../index.js";

describe("ontology CLI", () => {
  it("usage와 subcommand 해석에 ontology 루트를 노출한다", () => {
    expect(USAGE).toContain("qa-sdk ontology snapshot ingest");
    expect(USAGE).toContain("qa-sdk ontology corridor list");
    expect(USAGE).toContain("qa-sdk ontology checkpoint list");
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
            ],
            connections: [],
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
