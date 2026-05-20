import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cliTaxonomy } from "./taxonomy.js";

const GOOD_YAML = `
taxonomy: ok
version: 1
axes:
  scope:
    entries: [a, b]
    capacity: 4
`;

const BAD_YAML = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b, c, d]
    capacity: 4
`;

function writeTmp(name: string, content: string): string {
  const dir = join(tmpdir(), `tax-test-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

describe("cli tax validate", () => {
  it("OK yaml → exit 0", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", writeTmp("good.yaml", GOOD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it("warning yaml → exit 0 (warning은 통과)", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", writeTmp("warn.yaml", BAD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it("--strict 시 warning을 error로 → exit 1", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", "--strict", writeTmp("strict.yaml", BAD_YAML)]);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });
});
