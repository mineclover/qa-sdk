import { describe, expect, it } from "vitest";
import type { DocRecord } from "../../core/types.js";
import type {
  FeedbackProposalDraft,
  FeedbackProposalRecord,
  SemanticAliasRecord,
  SemanticGroundingEventInput,
  SemanticTermRecord,
  SemanticTermWithAliases,
} from "../../core/semantic-grounding/index.js";
import { SemanticGroundingService } from "./semantic-grounding.service.js";
import type { SemanticGroundingStore } from "../../stores/semantic-grounding-store.js";

class FakeStore implements SemanticGroundingStore {
  terms = new Map<string, SemanticTermRecord>();
  aliases: SemanticAliasRecord[] = [];
  events: SemanticGroundingEventInput[] = [];
  proposals: FeedbackProposalRecord[] = [];

  upsertTerm(record: SemanticTermRecord): void {
    this.terms.set(record.termId, record);
  }

  deleteTermsForDoc(docId: string): void {
    for (const [termId, term] of this.terms.entries()) {
      if (term.docId === docId) this.terms.delete(termId);
    }
    this.aliases = this.aliases.filter((alias) => this.terms.has(alias.termId));
  }

  deleteTermsNotInDocIds(docIds: readonly string[]): void {
    const keep = new Set(docIds);
    for (const [termId, term] of this.terms.entries()) {
      if (term.docId && !keep.has(term.docId)) this.terms.delete(termId);
    }
    this.aliases = this.aliases.filter((alias) => this.terms.has(alias.termId));
  }

  upsertAlias(record: SemanticAliasRecord): void {
    this.aliases = this.aliases.filter((alias) => alias.aliasId !== record.aliasId);
    this.aliases.push(record);
  }

  upsertRelation(): void {}

  listTermsForResolution(): SemanticTermWithAliases[] {
    return [...this.terms.values()].map((term) => ({
      ...term,
      aliases: this.aliases.filter((alias) => alias.termId === term.termId),
      relations: [],
    }));
  }

  listTermsByDocIds(docIds: readonly string[]): SemanticTermWithAliases[] {
    return [...this.terms.values()]
      .filter((term) => term.docId && docIds.includes(term.docId))
      .map((term) => ({ ...term, aliases: [], relations: [] }));
  }

  recordGroundingEvent(input: SemanticGroundingEventInput): string {
    this.events.push(input);
    return `event-${this.events.length}`;
  }

  upsertFeedbackProposal(input: FeedbackProposalDraft): FeedbackProposalRecord {
    const record: FeedbackProposalRecord = {
      ...input,
      proposalId: `proposal-${this.proposals.length + 1}`,
      status: "open",
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z",
    };
    this.proposals.push(record);
    return record;
  }

  listOpenFeedbackProposals(): FeedbackProposalRecord[] {
    return this.proposals;
  }
}

function doc(overrides: Partial<DocRecord> = {}): DocRecord {
  return {
    docId: "prefix-cart_event",
    title: "Cart System",
    scope: "data",
    aspect: "domain_data",
    depth: "overview",
    lifecycle: "approved",
    tags: ["cart", "event"],
    links: [{ target: "indexing-core-system", type: "depends_on" }],
    svc: "weighted-index",
    address: "def_document:v2:123",
    targetPrefix: "cart_event",
    version: 1,
    bodyHash: "hash",
    purpose: "상품 담기와 장바구니 이벤트를 설명한다.",
    intent: "cart add search grounding",
    context: "alias: 상품 담기",
    syncedAt: "2026-06-30T00:00:00.000Z",
    sourcePath: "docs/specs/prefix-catalog/event-prefix-group/prefix-cart_event.spec.md",
    ...overrides,
  };
}

describe("SemanticGroundingService", () => {
  it("materializes document terms and aliases into the store", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);

    const report = service.materializeDocuments([doc()]);

    expect(report.terms).toBeGreaterThanOrEqual(1);
    expect(report.aliases).toBeGreaterThanOrEqual(1);
    expect([...store.terms.values()][0]).toMatchObject({
      docId: "prefix-cart_event",
      canonicalLabel: "Cart System",
      coordinate: "def_document:v2:123",
      prefixId: "cart_event",
    });
    expect(store.aliases.map((alias) => alias.normalizedAlias)).toContain("상품 담기");
  });

  it("keeps same-normalized aliases from different sources without collision", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);

    const report = service.materializeDocuments([
      doc({
        purpose: "alias: cart event",
      }),
    ]);

    expect(report.aliases).toBeGreaterThanOrEqual(2);
    expect(
      store.aliases
        .filter((alias) => alias.normalizedAlias === "cart event")
        .map((alias) => alias.source)
        .sort(),
    ).toEqual(["deterministic-label", "document"]);
  });

  it("re-materializes documents by replacing stale aliases", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);

    service.materializeDocuments([
      doc({
        purpose: "alias: old grounding",
      }),
    ]);
    service.materializeDocuments([
      doc({
        purpose: "alias: new grounding",
      }),
    ]);

    const aliases = store.aliases.map((alias) => alias.normalizedAlias);
    expect(aliases).toContain("new grounding");
    expect(aliases).not.toContain("old grounding");
  });

  it("replaces stale document terms when a document is rematerialized", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);
    const first = doc();
    service.materializeDocuments([first]);
    expect([...store.terms.values()][0].canonicalLabel).toBe("Cart System");

    service.materializeDocuments([{ ...first, title: "Cart Event Updated", tags: ["updated"] }]);

    const terms = [...store.terms.values()];
    expect(terms).toHaveLength(1);
    expect(terms[0].canonicalLabel).toBe("Cart Event Updated");
    expect(store.aliases.some((alias) => alias.normalizedAlias === "updated")).toBe(true);
  });

  it("resolves aliases and records unresolved fallback proposals", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);
    service.materializeDocuments([doc()]);

    const plan = service.planDocumentSearch("상품 담기");
    expect(plan.candidateDocIds).toEqual(["prefix-cart_event"]);

    service.recordDocumentSearch({
      query: "없는 용어",
      plan: service.planDocumentSearch("없는 용어"),
      docs: [],
      legacyCount: 0,
      semanticCandidateCount: 0,
      semanticHitCount: 0,
      semanticOnlyCount: 0,
      legacyOnlyCount: 0,
    });
    expect(store.proposals[0]).toMatchObject({
      kind: "alias-add",
      normalizedTerm: "없는 용어",
    });
  });

  it("does not create proposals for blank query searches", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);

    service.recordDocumentSearch({
      query: "   ",
      plan: service.planDocumentSearch("   "),
      docs: [],
      legacyCount: 0,
      semanticCandidateCount: 0,
      semanticHitCount: 0,
      semanticOnlyCount: 0,
      legacyOnlyCount: 0,
    });

    expect(store.proposals).toHaveLength(0);
  });

  it("records wrong-scope feedback when semantic candidates miss and legacy hits remain", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);
    service.materializeDocuments([doc()]);

    service.recordDocumentSearch({
      query: "상품 담기",
      plan: service.planDocumentSearch("상품 담기"),
      docs: [doc()],
      legacyCount: 1,
      semanticCandidateCount: 1,
      semanticHitCount: 0,
      semanticOnlyCount: 0,
      legacyOnlyCount: 1,
    });

    expect(store.proposals[0]).toMatchObject({
      kind: "wrong-scope-or-alias-missing",
      normalizedTerm: "상품 담기",
    });
    expect(store.proposals[0]?.evidence).toMatchObject({
      reason: "semantic-candidates-no-scoped-hits",
      semanticCandidateCount: 1,
      semanticHitCount: 0,
      legacyCount: 1,
    });
  });

  it("records wrong-scope feedback when semantic and legacy results disagree", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);
    service.materializeDocuments([doc()]);

    service.recordDocumentSearch({
      query: "상품 담기 mismatch",
      plan: service.planDocumentSearch("상품 담기"),
      docs: [doc()],
      legacyCount: 1,
      semanticCandidateCount: 1,
      semanticHitCount: 1,
      semanticOnlyCount: 1,
      legacyOnlyCount: 1,
    });

    expect(store.proposals[0]).toMatchObject({
      kind: "wrong-scope-or-alias-missing",
      normalizedTerm: "상품 담기 mismatch",
    });
    expect(store.proposals[0]?.evidence).toMatchObject({
      reason: "semantic-legacy-disagreement",
      semanticOnlyCount: 1,
      legacyOnlyCount: 1,
    });
  });

  it("removes stale terms when a full snapshot omits a previously materialized document", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);

    service.materializeDocuments([
      doc({ docId: "prefix-cart_event", title: "Cart System" }),
      doc({ docId: "prefix-checkout_event", title: "Checkout System" }),
    ]);
    service.materializeDocuments([
      doc({ docId: "prefix-cart_event", title: "Cart System Updated" }),
    ], { replaceSnapshot: true });

    const remainingTermIds = new Set([...store.terms.keys()]);
    expect([...store.terms.values()].map((term) => term.docId).sort()).toEqual(["prefix-cart_event"]);
    expect(store.aliases.every((alias) => remainingTermIds.has(alias.termId))).toBe(true);
  });

  it("keeps low-confidence tag and svc matches below the planner threshold", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);
    service.materializeDocuments([doc()]);

    const plan = service.planDocumentSearch("weighted index");

    expect(plan.candidateDocIds).toEqual([]);
    expect(plan.fallbackReason).toBe("no-confident-candidate");
  });
});
