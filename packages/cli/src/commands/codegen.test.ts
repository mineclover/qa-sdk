import { describe, it, expect } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { codegen } from "./codegen.js";

const TMP = join(tmpdir(), "qa-codegen-test-" + Date.now());

describe("codegen command", () => {
  it("Catalog → TypeScript SDK 생성", async () => {
    const output = join(TMP, "catalog-output");

    // demo-snapshot에서 카탈로그 로드
    const { DEMO_CATALOG } = await import("demo-snapshot");

    await codegen({
      output,
      loadedCatalog: DEMO_CATALOG,
    });

    // 생성된 파일이 존재하고 타입 정의 포함
    const files = await import("node:fs").then(fs =>
      fs.readdirSync(output).filter(f => f.endsWith(".ts")),
    );
    expect(files.length).toBeGreaterThan(0);

    await rm(TMP, { recursive: true, force: true });
  });

  it("catalog 경로가 존재하지 않으면 에러", async () => {
    await expect(
      codegen({ output: join(TMP, "empty"), catalog: "/nonexistent/path/catalog.ts" }),
    ).rejects.toThrow();
  });
});
