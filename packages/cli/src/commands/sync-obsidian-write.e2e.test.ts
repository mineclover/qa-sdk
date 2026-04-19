// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { main } from "../index.js";

const writeSmokeVault = process.env.QA_SDK_OBSIDIAN_WRITE_SMOKE_VAULT;
const hasObsidianCli = spawnSync("obsidian", ["--help"], { encoding: "utf-8" }).status === 0;
const runWriteSmoke = Boolean(writeSmokeVault) && hasObsidianCli;
const writeIt = runWriteSmoke ? it : it.skip;

describe("sync-obsidian write path E2E", () => {
  writeIt("dedicated vault에 실제 write 후 대표 노트를 읽을 수 있다", async () => {
    const vault = writeSmokeVault!;
    const syncOutput = await captureConsoleAsync(async () => {
      await main(["sync-obsidian", "--vault", vault]);
    });

    expect(syncOutput.stdout).toContain(`DEMO_CATALOG → Obsidian 볼트 "${vault}" 동기화`);
    expect(syncOutput.stdout).toContain("mode: write");
    expect(syncOutput.stdout).toContain("완료:");

    const readOutput = await captureConsoleAsync(async () => {
      await main(["obs", "read", "_index.md", "--vault", vault]);
    });

    expect(readOutput.stdout).toContain("# spec-prefix");
    expect(readOutput.stdout).toContain("[[_index]]");
  });
});

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
