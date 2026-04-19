// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalHome = process.env.HOME;
const originalQaSdkHome = process.env.QA_SDK_HOME;
const tempDirs: string[] = [];

describe("quality CLI smoke", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalQaSdkHome === undefined) delete process.env.QA_SDK_HOME;
    else process.env.QA_SDK_HOME = originalQaSdkHome;
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("quality show/run을 fixture gate 문서 기준 실제 실행 smoke로 검증한다", async () => {
    const root = await createQualityFixtureRepo();
    process.env.HOME = root;
    process.env.QA_SDK_HOME = join(root, ".qa-sdk-home");
    await mkdir(process.env.QA_SDK_HOME, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(root);

    vi.resetModules();
    const { main } = await import("../index.js");

    const showOutput = await captureConsoleAsync(async () => {
      await main(["quality", "show", "gate-quality-fixture", "--scan"]);
    });

    expect(showOutput.stdout).toContain("gate-quality-fixture");
    expect(showOutput.stdout).toContain("bundle:     quality-fixture-bundle");
    expect(showOutput.stdout).toContain("command:    printf fixture-pass");

    const runOutput = await captureConsoleAsync(async () => {
      await main(["quality", "run", "gate-quality-fixture", "--scan", "--json"]);
    });

    const json = JSON.parse(runOutput.stdout);
    expect(json.gateDocId).toBe("gate-quality-fixture");
    expect(json.outcome).toBe("pass");
    expect(json.bundleId).toBe("quality-fixture-bundle");
    expect(json.bundleVerification).toEqual(
      expect.objectContaining({
        verified: true,
        verifiedGates: 1,
        totalGates: 1,
      }),
    );
    expect(existsSync(join(process.env.QA_SDK_HOME!, ".qa-sdk", "quality-ledger.sqlite"))).toBe(true);
  });
});

async function createQualityFixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "qa-quality-smoke-"));
  tempDirs.push(root);
  const docsDir = join(root, "docs", "specs");
  await mkdir(docsDir, { recursive: true });

  await writeFile(
    join(docsDir, "quality-fixture-bundle.md"),
    `---
def:
  id: quality-fixture-bundle
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  links:
    - target: gate-quality-fixture
      type: contains
---

# Quality Fixture Bundle

## 목적 ^purpose

fixture gate smoke를 묶는 최소 번들이다.

## 구성 ^overview

- gate-quality-fixture: printf 기반 fixture gate
`,
    "utf-8",
  );

  await writeFile(
    join(docsDir, "gate-quality-fixture.spec.md"),
    `---
def:
  id: gate-quality-fixture
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: quality-fixture-bundle
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  package: cli
  command: printf fixture-pass
  successPattern: stdout contains "fixture-pass"
---

# Quality Fixture Gate

## 목적 ^purpose

quality show/run smoke에서 실제 명령 실행 경로를 검증하는 fixture gate다.
`,
    "utf-8",
  );

  return root;
}

async function captureConsoleAsync(run: () => Promise<void>): Promise<{ stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: unknown[]) => {
    stdout.push(args.join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.join(" "));
  };
  console.warn = (...args: unknown[]) => {
    stderr.push(args.join(" "));
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}
