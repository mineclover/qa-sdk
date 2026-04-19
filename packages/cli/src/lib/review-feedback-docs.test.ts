// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { syncDocsToLocalDb } from "definition-data-source";
import { resolveRelatedDocsForFiles } from "./review-feedback-docs.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, "../../../..");

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "qa-sdk-review-feedback-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("review-feedback-docs", () => {
  it("코드 파일에 대해 관련 definition 문서 후보를 찾는다", async () => {
    const rootDir = MONOREPO_ROOT;
    const tempDir = makeTempDir();
    const dbPath = join(tempDir, "definition-service.sqlite");

    await syncDocsToLocalDb({ rootDir, dbPath });

    const result = await resolveRelatedDocsForFiles(rootDir, [
      "packages/review-ledger/src/types.ts",
      "packages/review-ledger/src/ledger.ts",
    ], {
      mode: "local",
      dbPath,
    });

    expect(result["packages/review-ledger/src/types.ts"]).toBeDefined();
    expect(result["packages/review-ledger/src/types.ts"]!.length).toBeGreaterThan(0);
    expect(
      result["packages/review-ledger/src/types.ts"]!.some(
        (doc) => doc.docId === "review-ledger-spec",
      ),
    ).toBe(true);
  }, 20_000);
});
