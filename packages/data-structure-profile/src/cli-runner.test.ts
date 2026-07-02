import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { runDataStructureProfileCli } from "./cli-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, "../../../docs/proposals/data-structure-profile/fixtures");
const taxonomyPath = join(__dirname, "../../../docs/taxonomies/data-structure-profile.yaml");
const profilePath = join(fixtureDir, "order-events.profile.yaml");

function readJsonFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8")) as T;
}

function createIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      cwd: fixtureDir,
      readText: (path: string) => readFileSync(path, "utf8"),
      writeStdout: (text: string) => stdout.push(text),
      writeStderr: (text: string) => stderr.push(text),
    },
  };
}

describe("data-structure-profile CLI runner", () => {
  test("validates a profile fixture with taxonomy vocabulary", async () => {
    const { io, stdout, stderr } = createIo();

    const exitCode = await runDataStructureProfileCli(
      ["validate", profilePath, "--taxonomy", taxonomyPath],
      io,
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join(""))).toEqual(readJsonFixture("expected-validation-report.json"));
  });

  test("compiles, measures, and checks DPM readiness from the same profile path", async () => {
    const commands = [
      ["compile", "order-events.profile.yaml", "expected-lineage.json"],
      ["measure", "order-events.profile.yaml", "expected-measurement-report.json"],
      ["dpm-readiness", "order-events.profile.yaml", "expected-dpm-readiness.json"],
    ];

    for (const [command, path, expected] of commands) {
      const { io, stdout, stderr } = createIo();

      const exitCode = await runDataStructureProfileCli([command!, path!], io);

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(JSON.parse(stdout.join(""))).toEqual(readJsonFixture(expected!));
    }
  });

  test("emits adapter-compatible quality-ledger and bench bridge payloads", async () => {
    const validation = createIo();
    const validationExit = await runDataStructureProfileCli(
      ["validate", profilePath, "--adapter", "quality-ledger"],
      validation.io,
    );

    expect(validationExit).toBe(0);
    expect(JSON.parse(validation.stdout.join(""))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateDocId: "data-structure-profile/order-events-to-order-item-facts/privacy-readiness",
          outcome: "pass",
          successPattern: "privacy-readiness",
        }),
      ]),
    );

    const measurement = createIo();
    const measurementExit = await runDataStructureProfileCli(
      ["measure", profilePath, "--adapter", "bench"],
      measurement.io,
    );

    expect(measurementExit).toBe(0);
    expect(JSON.parse(measurement.stdout.join(""))).toMatchObject({
      title: "Data Structure Profile Measurement",
      metadata: {
        profile: "order-events-to-order-item-facts",
        rowMultiplier: 5,
      },
      summary: {
        scenarioId: "data-structure-profile:order-events-to-order-item-facts:measurement-dry-run",
        scenarioRate: 5000,
      },
    });
  });

  test("prints usage and exits non-zero for invalid invocation", async () => {
    const { io, stdout, stderr } = createIo();

    const exitCode = await runDataStructureProfileCli(["unknown"], io);

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr.join("")).toContain("Usage:");
  });
});
