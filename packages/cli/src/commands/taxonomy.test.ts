import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
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

const SHOW_YAML = `
taxonomy: tx
version: 1
axes:
  scope:
    entries: [a, b]
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

describe("cli tax show", () => {
  it("entry 조회 → exit 0 + 정보 출력", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const file = writeTmp("show.yaml", SHOW_YAML);
    await cliTaxonomy(["show", file, "tx:scope.a"]);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    exit.mockRestore();
  });

  it("해소 실패 → exit 1", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const file = writeTmp("show.yaml", SHOW_YAML);
    await cliTaxonomy(["show", file, "tx:scope.missing"]);
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
    exit.mockRestore();
  });
});

describe("cli tax codegen", () => {
  it("정상 yaml → 5 파일 생성", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const file = writeTmp("ok.yaml", GOOD_YAML);
    const outDir = join(tmpdir(), `tax-cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await cliTaxonomy(["codegen", file, "--out", outDir]);

    expect(exit).not.toHaveBeenCalledWith(1);
    expect(existsSync(join(outDir, "axes.ts"))).toBe(true);
    expect(existsSync(join(outDir, "addresses.ts"))).toBe(true);
    expect(existsSync(join(outDir, "registry.ts"))).toBe(true);
    expect(existsSync(join(outDir, "relations.ts"))).toBe(true);
    expect(existsSync(join(outDir, "meta.ts"))).toBe(true);

    rmSync(outDir, { recursive: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("--out 누락 → exit 1", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const file = writeTmp("ok.yaml", GOOD_YAML);
    await cliTaxonomy(["codegen", file]);
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
    exit.mockRestore();
  });

  it("broken IR + --skip-validate → 생성 성공", async () => {
    const brokenYaml = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b]
    capacity: 2
relations:
  r:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: a, lower: missing }
`;
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const file = writeTmp("bad.yaml", brokenYaml);
    const outDir = join(tmpdir(), `tax-cg-skip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await cliTaxonomy(["codegen", file, "--out", outDir, "--skip-validate"]);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(existsSync(join(outDir, "axes.ts"))).toBe(true);

    rmSync(outDir, { recursive: true });
    log.mockRestore();
    exit.mockRestore();
  });
});
