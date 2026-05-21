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

  it("decisionLink 'decision:<id>' 형식 → docs/decisions/<id>.md 해소", async () => {
    const yaml = `taxonomy: test
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: cue, address: 0, lifecycle: tbd, placeholderReason: "결정 대기", decisionLink: "decision:test.layer.cue" }
      - { id: stage, address: 1, lifecycle: approved }
`;
    const decision = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: approved
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

# Decision\n\n결정 완료. ^outcome\n`;
    const dir = setupRepo({
      yaml,
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

  it("decisionLink 'decision:<id>' + 파일 없음 → push-create skeleton", async () => {
    const yaml = `taxonomy: test
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: cue, address: 0, lifecycle: tbd, placeholderReason: "결정 대기", decisionLink: "decision:test.layer.cue" }
`;
    const dir = setupRepo({ yaml });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync"]));
    const dPath = join(dir, "docs/decisions/test.layer.cue.md");
    expect(existsSync(dPath)).toBe(true);
    const created = readFileSync(dPath, "utf8");
    expect(created).toMatch(/lifecycle: draft/);
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

  // 부채 #1: yaml tbd + decision draft (skeleton 생성 직후 상태) → in-sync 보존
  it("yaml tbd + decision draft → in-sync, yaml/decision 모두 변경 없음", async () => {
    const decision = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: draft
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

# Decision

interaction 정의 미정 ^purpose
`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": decision },
    });
    const yamlBefore = readFileSync(join(dir, "docs/taxonomies/test.yaml"), "utf8");
    const decisionBefore = readFileSync(
      join(dir, "docs/decisions/test.layer.cue.md"),
      "utf8",
    );
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    // yaml tbd 유지, decision draft 유지, commit 없음
    expect(readFileSync(join(dir, "docs/taxonomies/test.yaml"), "utf8")).toBe(yamlBefore);
    expect(
      readFileSync(join(dir, "docs/decisions/test.layer.cue.md"), "utf8"),
    ).toBe(decisionBefore);
    expect(out).toMatch(/✔\s+tax:test:layer\.cue/);
    const log_out = execSync("git log --oneline", { cwd: dir, encoding: "utf8" });
    expect(log_out.split("\n").filter((l) => l.length > 0)).toHaveLength(1); // initial commit만
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  // 부채 #4: --no-commit
  it("--no-commit: 파일 변경 적용 + commit 생략", async () => {
    const dir = setupRepo({ yaml: YAML_WITH_TBD });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync", "--no-commit"]));
    const dPath = join(dir, "docs/decisions/test.layer.cue.md");
    expect(existsSync(dPath)).toBe(true);
    // 새 commit 없음 (initial만)
    const log_out = execSync("git log --oneline", { cwd: dir, encoding: "utf8" });
    expect(log_out.split("\n").filter((l) => l.length > 0)).toHaveLength(1);
    // working tree에 untracked 파일 존재 (-u로 디렉토리 내부까지)
    const status = execSync("git status --porcelain -uall", {
      cwd: dir,
      encoding: "utf8",
    });
    expect(status).toMatch(/test\.layer\.cue\.md/);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  // 부채 #8: pull-yaml-lifecycle commit 메시지에 evidence 포함
  it("commit 메시지에 evidence 멀티라인 포함 (부채 #8)", async () => {
    const decision = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: approved
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

# Decision

전제 검토 ^purpose

선행 사례 검토 ^evidence:precedent weight=0.8

PoC 데이터 분석 ^evidence:data weight=0.6

결정 완료 ^outcome
`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": decision },
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync"]));
    const msg = execSync("git log -1 --format=%B", { cwd: dir, encoding: "utf8" });
    expect(msg).toMatch(/sync\(taxonomy\): tax:test:layer\.cue lifecycle → approved/);
    expect(msg).toMatch(/Evidence:/);
    expect(msg).toMatch(/- precedent:.*weight 0\.8/);
    expect(msg).toMatch(/- data:.*weight 0\.6/);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  // 부채 #8: markers-only 보고
  it("같은 lifecycle + markers 변경 → markers-only 보고 (commit 안 함)", async () => {
    // yaml에 tbd, decision draft 동일 + evidence 추가된 케이스
    const decisionInitial = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: draft
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

# Decision

initial purpose ^purpose
`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": decisionInitial },
    });
    // 후속 변경: evidence 추가 (lifecycle 동일)
    const decisionUpdated = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: draft
created: 2026-05-21T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

# Decision

initial purpose ^purpose

신규 evidence ^evidence:data weight=1
`;
    writeFileSync(join(dir, "docs/decisions/test.layer.cue.md"), decisionUpdated);

    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["sync"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toMatch(/markers/);
    // commit 없음 (initial만)
    const log_out = execSync("git log --oneline", { cwd: dir, encoding: "utf8" });
    expect(log_out.split("\n").filter((l) => l.length > 0)).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });
});

describe("cli decision analyze", () => {
  it("decision 파일 있으면 schema/branches/evidence/coreGate 출력", async () => {
    const decisionMd = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: review
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

# Decision

interaction 경계 결정 필요. ^purpose

## 옵션

Cue가 포함. ^option:cue-includes

Beat 분리. ^option:beat-separate

## 증거

TAXONOMY.md §Cue. ^evidence:precedent weight=0.8

PoC 데이터. ^evidence:data weight=0.6

## 결정

(미정) ^outcome
`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": decisionMd },
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["analyze"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toContain("tax:test:layer.cue");
    expect(out).toContain("lifecycle:     review");
    expect(out).toMatch(/branches:\s+2/);
    expect(out).toMatch(/evidence:\s+2/);
    expect(out).toContain("precedent");
    expect(out).toContain("data");
    expect(out).toContain("core gates:");
    expect(exit).not.toHaveBeenCalledWith(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("skeleton 상태(branches/evidence 0건) → 친절 메시지, schema issues 미표시", async () => {
    const skeleton = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: draft
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

질문만 있음. ^purpose
`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": skeleton },
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["analyze"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toContain("🌱 skeleton");
    expect(out).not.toMatch(/schema issues/);
    expect(out).not.toMatch(/branches\s+0/);
    expect(exit).not.toHaveBeenCalledWith(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("decision 파일 없으면 분석 대상 0건 + exit 0", async () => {
    const dir = setupRepo({ yaml: YAML_WITH_TBD });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["analyze"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toContain("분석 대상 decision 없음");
    expect(exit).not.toHaveBeenCalledWith(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("render: decision 파일 → stdout markdown 출력 (^purpose 보존)", async () => {
    const decisionMd = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: review
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

# Decision

질문 ^purpose

Cue 포함 ^option:a
`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": decisionMd },
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["render"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toContain("질문 ^purpose");
    expect(out).toContain("^option:a");
    expect(exit).not.toHaveBeenCalledWith(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it("--json 출력 — schema/profiles 포함", async () => {
    const minimal = `---
id: test.layer.cue
subject: tax:test:layer.cue
lifecycle: draft
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

질문. ^purpose
`;
    const dir = setupRepo({
      yaml: YAML_WITH_TBD,
      decisionDir: "docs/decisions",
      decisions: { "test.layer.cue.md": minimal },
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withCwd(dir, () => cliDecision(["analyze", "--json"]));
    const out = log.mock.calls.map((c) => String(c[0])).join("\n");
    const parsed = JSON.parse(out);
    expect(parsed.reports).toHaveLength(1);
    expect(parsed.reports[0].schema.id).toBe("test.layer.cue");
    expect(parsed.reports[0].profiles).toBeDefined();
    expect(exit).not.toHaveBeenCalledWith(1);
    rmSync(dir, { recursive: true, force: true });
    log.mockRestore();
    exit.mockRestore();
  });
});
