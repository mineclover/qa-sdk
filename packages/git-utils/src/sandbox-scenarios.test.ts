/**
 * 샌드박스 기반 시나리오 테스트 — 실제 프로젝트 구조를 복제하여 검증.
 *
 * 기존 테스트: 빈 repo → 수동 파일 생성 (인위적)
 * 이 테스트: MONOREPO_FILES 프리셋 → 실제와 유사한 구조
 */

import { afterEach, describe, it, expect } from "vitest";
import { createSandbox, MONOREPO_FILES, SINGLE_PKG_FILES, type Sandbox } from "./__fixtures__/create-sandbox.js";
import { analyzeRemoteBranchConflicts } from "./branch-conflicts-analysis.js";
import { collectWorkspaceChanges } from "./branch-conflicts-workspace.js";

const sandboxes: Sandbox[] = [];

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map(s => s.cleanup()));
});

// ── 샌드박스 자체 검증 ────────────────────────────────

describe("createSandbox", () => {
  it("모노레포 프리셋으로 repo 생성", async () => {
    const sb = await createSandbox({
      name: "mono",
      withRemote: true,
      files: MONOREPO_FILES,
    });
    sandboxes.push(sb);

    // git log 확인
    const log = sb.git(["log", "--oneline"]);
    expect(log).toContain("seed");

    // .gitignore 존재
    const files = sb.git(["ls-files"]);
    expect(files).toContain(".gitignore");
    expect(files).toContain("packages/api/src/index.ts");
  });

  it("브랜치 생성 + 파일 변경 + push", async () => {
    const sb = await createSandbox({
      name: "branch",
      withRemote: true,
      files: SINGLE_PKG_FILES,
    });
    sandboxes.push(sb);

    sb.createBranch("feature/test");
    sb.commitFile("src/new-feature.ts", "export const x = 1;\n", "feat: new feature");
    sb.push("feature/test");

    const branches = sb.git(["branch", "-r"]);
    expect(branches).toContain("feature/test");
  });
});

// ── 모노레포 시나리오 ─────────────────────────────────

describe("모노레포 충돌 분석", () => {
  it("두 브랜치가 같은 패키지 수정 → overlap + hotspot", { timeout: 30000 }, async () => {
    const sb = await createSandbox({
      name: "mono-conflict",
      withRemote: true,
      files: MONOREPO_FILES,
    });
    sandboxes.push(sb);

    // feature/api-refactor — api 패키지 수정
    sb.createBranch("feature/api-refactor");
    sb.commitFile("packages/api/src/index.ts", 'export function hello() { return "refactored"; }\n', "refactor(api): index");
    sb.commitFile("packages/api/src/handler.ts", 'export function handle(req: any) { return { ...req, v2: true }; }\n', "refactor(api): handler");
    sb.push("feature/api-refactor");

    // feature/web-update — web + api 공유 파일 수정
    sb.checkout("main");
    sb.createBranch("feature/web-update");
    sb.commitFile("packages/web/src/app.ts", 'export function App() { return "updated app"; }\n', "feat(web): update");
    sb.commitFile("packages/api/src/index.ts", 'export function hello() { return "from web branch"; }\n', "feat(api): web needs");
    sb.push("feature/web-update");

    // 현재 브랜치에서 분석
    sb.checkout("main");
    sb.createBranch("feature/current");
    sb.commitFile("packages/api/src/index.ts", 'export function hello() { return "current"; }\n', "feat(api): current");

    const result = await analyzeRemoteBranchConflicts({
      cwd: sb.workDir,
      remoteName: "origin",
      baseRef: "origin/main",
      fetch: false,
    });

    // api/src/index.ts가 3개 브랜치에서 변경 → hotspot
    const apiHotspot = result.hotspots.find(h => h.path === "packages/api/src/index.ts");
    expect(apiHotspot).toBeDefined();
    expect(apiHotspot!.branches.length).toBeGreaterThanOrEqual(2);

    // overlap 확인
    expect(result.branches.length).toBeGreaterThanOrEqual(1);
  });

  it(".gitignore에 의해 dist/ 파일은 추적되지 않음", { timeout: 15000 }, async () => {
    const sb = await createSandbox({
      name: "mono-ignore",
      withRemote: true,
      files: MONOREPO_FILES,
    });
    sandboxes.push(sb);

    // dist/ 파일 생성 (gitignore 대상)
    await sb.writeFile("packages/api/dist/index.js", "compiled\n");

    const ws = collectWorkspaceChanges(sb.workDir, sb.workDir);
    // dist/ 파일은 gitignore에 의해 untracked로 잡히지 않아야 함
    const distFiles = ws?.files.filter(f => f.path.includes("dist/")) ?? [];
    expect(distFiles).toHaveLength(0);
  });

  it("하위 패키지 scope에서 workspace 변경 분석", { timeout: 15000 }, async () => {
    const sb = await createSandbox({
      name: "mono-scope",
      withRemote: true,
      files: MONOREPO_FILES,
    });
    sandboxes.push(sb);

    // api 패키지에만 uncommitted 변경
    await sb.writeFile("packages/api/src/new.ts", "new file\n");
    // web 패키지에도 변경
    await sb.writeFile("packages/web/src/new.ts", "web new\n");

    // api 패키지 scope로 분석
    const apiWs = collectWorkspaceChanges(sb.workDir, `${sb.workDir}/packages/api`);
    expect(apiWs).toBeDefined();
    expect(apiWs!.relativePath).toBe("packages/api");
    // api 변경만 포함
    expect(apiWs!.paths.some(p => p.includes("api/src/new.ts"))).toBe(true);
    // web 변경은 제외
    expect(apiWs!.paths.some(p => p.includes("web/"))).toBe(false);
  });
});

// ── 단일 패키지 시나리오 ──────────────────────────────

describe("단일 패키지 분석", () => {
  it("remote 없는 로컬 전용 repo → workspace 분석 가능", { timeout: 15000 }, async () => {
    const sb = await createSandbox({
      name: "local-only",
      withRemote: false,
      files: SINGLE_PKG_FILES,
    });
    sandboxes.push(sb);

    await sb.writeFile("src/draft.ts", "draft code\n");

    const ws = collectWorkspaceChanges(sb.workDir, sb.workDir);
    expect(ws).toBeDefined();
    expect(ws!.paths).toContain("src/draft.ts");
    expect(ws!.files.find(f => f.path === "src/draft.ts")?.status).toBe("Untracked");
  });
});
