import { describe, expect, it } from "vitest";
import { resolveSemanticCandidates } from "./resolver.js";
import type { SemanticTermWithAliases } from "./types.js";

const terms: SemanticTermWithAliases[] = [
  {
    termId: "term-cart-add",
    kind: "document",
    canonicalLabel: "cart add",
    normalizedLabel: "cart add",
    coordinate: "cart_event:v2:10",
    prefixId: "cart_event",
    versionId: "v2",
    address: 10,
    docId: "prefix-cart_event",
    sourcePath: "docs/specs/prefix-catalog/event-prefix-group/prefix-cart_event.spec.md",
    evidence: { source: "test" },
    aliases: [
      {
        aliasId: "alias-1",
        termId: "term-cart-add",
        alias: "상품 담기",
        normalizedAlias: "상품 담기",
        locale: "ko",
        source: "manual",
        confidence: 0.95,
        createdAt: "2026-06-30T00:00:00.000Z",
      },
    ],
    relations: [],
    updatedAt: "2026-06-30T00:00:00.000Z",
  },
  {
    termId: "term-cart-remove",
    kind: "document",
    canonicalLabel: "cart remove",
    normalizedLabel: "cart remove",
    coordinate: "cart_event:v2:11",
    prefixId: "cart_event",
    versionId: "v2",
    address: 11,
    docId: "prefix-cart_event",
    sourcePath: "docs/specs/prefix-catalog/event-prefix-group/prefix-cart_event.spec.md",
    evidence: { source: "test" },
    aliases: [],
    relations: [],
    updatedAt: "2026-06-30T00:00:00.000Z",
  },
];

describe("resolveSemanticCandidates", () => {
  it("ranks exact aliases above token overlap", () => {
    const resolution = resolveSemanticCandidates("상품 담기", terms);
    expect(resolution.query.normalized).toBe("상품 담기");
    expect(resolution.candidates[0]).toMatchObject({
      termId: "term-cart-add",
      confidence: 0.95,
      matchedBy: "alias",
    });
    expect(resolution.confident).toBe(true);
  });

  it("keeps ambiguous candidates instead of collapsing them", () => {
    const resolution = resolveSemanticCandidates("cart", terms, { confidenceThreshold: 0.5 });
    expect(resolution.candidates.map((candidate) => candidate.termId)).toEqual([
      "term-cart-add",
      "term-cart-remove",
    ]);
    expect(resolution.confident).toBe(false);
  });
});
