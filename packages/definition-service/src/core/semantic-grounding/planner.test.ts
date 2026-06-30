import { describe, expect, it } from "vitest";
import type { DocRecord } from "../types.js";
import { mergeSemanticDocumentResults, planDocumentSearch } from "./planner.js";
import type { SemanticResolution } from "./types.js";

function resolution(docIds: readonly string[], confident = true): SemanticResolution {
  return {
    query: { raw: "상품 담기", normalized: "상품 담기", tokens: ["상품", "담기"] },
    confident,
    candidates: docIds.map((docId, index) => ({
      termId: `term-${index}`,
      canonicalLabel: `label-${index}`,
      confidence: 0.9 - index * 0.1,
      matchedBy: "alias",
      evidence: [{ kind: "alias", ref: "상품 담기", weight: 0.95 }],
      docId,
      coordinate: `cart_event:v2:${index}`,
      prefixId: "cart_event",
      versionId: "v2",
      address: index,
    })),
  };
}

function doc(docId: string): DocRecord {
  return {
    docId,
    title: docId,
    scope: "data",
    aspect: "domain_data",
    depth: "overview",
    lifecycle: "approved",
    tags: [],
    links: [],
    version: 1,
    bodyHash: `${docId}-hash`,
    syncedAt: "2026-06-30T00:00:00.000Z",
  };
}

describe("document grounding planner", () => {
  it("builds a scoped plan from confident candidates", () => {
    const plan = planDocumentSearch("상품 담기", resolution(["doc-a", "doc-b"]));
    expect(plan.kind).toBe("document-search");
    expect(plan.query).toBe("상품 담기");
    expect(plan.candidateDocIds).toEqual(["doc-a", "doc-b"]);
    expect(plan.fallbackReason).toBeUndefined();
  });

  it("keeps legacy fallback when no candidate is confident", () => {
    const plan = planDocumentSearch("없는 용어", resolution([], false));
    expect(plan.candidateDocIds).toEqual([]);
    expect(plan.fallbackReason).toBe("no-confident-candidate");
  });

  it("merges semantic docs ahead of legacy FTS without duplicates", () => {
    const merged = mergeSemanticDocumentResults({
      semanticDocs: [doc("doc-b"), doc("doc-a")],
      legacyDocs: [doc("doc-a"), doc("doc-c")],
      candidateDocIds: ["doc-a", "doc-b"],
      limit: 10,
      offset: 0,
    });
    expect(merged.map((item) => item.docId)).toEqual(["doc-a", "doc-b", "doc-c"]);
  });
});
