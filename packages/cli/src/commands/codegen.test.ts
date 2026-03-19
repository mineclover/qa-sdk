import { describe, it, expect } from "vitest";
import { writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { codegen } from "./codegen.js";

const TMP = join(tmpdir(), "qa-codegen-test-" + Date.now());

const SNAPSHOT = {
  id: "git-dsl-v1",
  axes: [
    { id: "git_repo", entries: ["qa-sdk", "frontend"], capacity: 64 },
    { id: "git_branch_type", entries: ["main", "feature"], capacity: 8 },
  ],
  composites: [
    { id: "git_build_addr", dims: ["git_repo", "git_branch_type"], owner: "git-dsl-v1" },
  ],
};

describe("codegen command", () => {
  it("단일 파일 → proto + ts 생성", async () => {
    const input = join(TMP, "input");
    const output = join(TMP, "output");
    await mkdir(input, { recursive: true });
    await writeFile(join(input, "git-dsl-v1.json"), JSON.stringify(SNAPSHOT));

    await codegen({
      formats: ["proto", "ts"],
      input: join(input, "git-dsl-v1.json"),
      output,
    });

    const proto = await readFile(join(output, "git-dsl-v1.proto"), "utf-8");
    expect(proto).toContain("enum GitRepo {");
    expect(proto).toContain("GIT_REPO_QA_SDK = 1;");
    expect(proto).toContain("message ApmRecord {");

    const ts = await readFile(join(output, "git-dsl-v1.d.ts"), "utf-8");
    expect(ts).toContain("export const GIT_REPO = {");
    expect(ts).toContain('QA_SDK: "qa-sdk",');
    expect(ts).toContain("export interface GitBuildAddrDims {");

    await rm(TMP, { recursive: true, force: true });
  });

  it("디렉토리 입력 → 여러 스냅샷 처리", async () => {
    const input = join(TMP, "multi-input");
    const output = join(TMP, "multi-output");
    await mkdir(input, { recursive: true });

    await writeFile(join(input, "a.json"), JSON.stringify({ ...SNAPSHOT, id: "a" }));
    await writeFile(join(input, "b.json"), JSON.stringify({ ...SNAPSHOT, id: "b" }));

    await codegen({ formats: ["ts"], input, output });

    const a = await readFile(join(output, "a.d.ts"), "utf-8");
    const b = await readFile(join(output, "b.d.ts"), "utf-8");
    expect(a).toContain('SchemaSnapshot "a"');
    expect(b).toContain('SchemaSnapshot "b"');

    await rm(TMP, { recursive: true, force: true });
  });
});
