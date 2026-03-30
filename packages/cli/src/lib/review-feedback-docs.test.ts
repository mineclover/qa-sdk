import { describe, expect, it } from "vitest";
import { resolveRelatedDocsForFiles } from "./review-feedback-docs.js";

describe("review-feedback-docs", () => {
  it("코드 파일에 대해 관련 definition 문서 후보를 찾는다", async () => {
    const result = await resolveRelatedDocsForFiles(process.cwd(), [
      "packages/review-ledger/src/types.ts",
      "packages/review-ledger/src/ledger.ts",
    ]);

    expect(result["packages/review-ledger/src/types.ts"]).toBeDefined();
    expect(result["packages/review-ledger/src/types.ts"]!.length).toBeGreaterThan(0);
    expect(
      result["packages/review-ledger/src/types.ts"]!.some(
        (doc) => doc.docId === "review-ledger-spec",
      ),
    ).toBe(true);
  });
});
