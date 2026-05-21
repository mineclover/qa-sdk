import { describe, it, expect, vi } from "vitest";
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { cliDecision } from "./decision/index.js";

function setupRepo(opts: { yaml: string; decisionDir?: string; decisions?: Record<string, string> }) {
  const dir = join(tmpdir(), `dec-${Date.now()}-${randomBytes(4).toString("hex")}`);
  mkdirSync(join(dir, "docs/taxonomies"), { recursive: true });
  writeFileSync(join(dir, "docs/taxonomies/test.yaml"), opts.yaml);
  if (opts.decisionDir) {
    mkdirSync(join(dir, opts.decisionDir), { recursive: true });
    for (const [name, content] of Object.entries(opts.decisions ?? {})) {
      writeFileSync(join(dir, opts.decisionDir, name), content);
    }
  }
  // git init for commit step
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "test@example.com"', { cwd: dir });
  execSync('git config user.name "test"', { cwd: dir });
  execSync("git add -A && git commit -q -m initial", { cwd: dir });
  return dir;
}

function withCwd<T>(dir: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return Promise.resolve(fn()).finally(() => process.chdir(prev));
  } catch (e) {
    process.chdir(prev);
    throw e;
  }
}

const YAML_WITH_TBD = `taxonomy: test
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: cue, address: 0, lifecycle: tbd, placeholderReason: "결정 대기", decisionLink: "../decisions/test.layer.cue.md" }
      - { id: stage, address: 1, lifecycle: approved }
`;

describe("cli decision sync", () => {
  it("--dry-run: decision 파일 없으면 push-create 보고 + 변경 미적용", async () => {
    const dir = setupRepo({ yaml: YAML_WITH_TBD });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync", "--dry-run"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toMatch(/\+\s+tax:test:layer\.cue/);
    expect(existsSync(join(dir, "docs/decisions/test.layer.cue.md"))).toBe(false);
    expect(exit).not.toHaveBeenCalledWith(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("실제 실행: push-create + commit 생성", async () => {
    const dir = setupRepo({ yaml: YAML_WITH_TBD });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync"]));
    const dPath = join(dir, "docs/decisions/test.layer.cue.md");
    expect(existsSync(dPath)).toBe(true);
    const created = readFileSync(dPath, "utf8");
    expect(created).toMatch(/lifecycle: draft/);
    expect(created).toMatch(/결정 대기/);
    // commit 생성 확인
    const log_out = execSync("git log --oneline", { cwd: dir, encoding: "utf8" });
    expect(log_out).toMatch(/chore\(decision\): create skeleton/);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("yaml tbd + decision approved → pull-yaml-lifecycle + commit", async () => {
    const decision = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: approved
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

# Decision\n\n결정 완료. ^outcome\n`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": decision },
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync"]));
    const yamlAfter = readFileSync(join(dir, "docs/taxonomies/test.yaml"), "utf8");
    expect(yamlAfter).toMatch(/id: cue,[^\n]*lifecycle: approved/);
    const log_out = execSync("git log --oneline", { cwd: dir, encoding: "utf8" });
    expect(log_out).toMatch(/sync\(taxonomy\):.*lifecycle → approved/);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("decisionLink 없음 → noop, exit 0", async () => {
    const yaml = `taxonomy: test
version: 1
axes:
  a:
    lifecycle: approved
    entries: [{ id: x, address: 0, lifecycle: approved }]
`;
    const dir = setupRepo({ yaml });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync", "--dry-run"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toMatch(/대상 없음/);
    expect(exit).not.toHaveBeenCalledWith(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });
});
