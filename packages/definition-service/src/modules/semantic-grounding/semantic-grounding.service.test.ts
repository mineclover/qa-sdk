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

function doc(): DocRecord {
  return {
    docId: "prefix-cart_event",
    title: "Cart Event",
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
      canonicalLabel: "Cart Event",
      coordinate: "def_document:v2:123",
      prefixId: "cart_event",
    });
    expect(store.aliases.map((alias) => alias.normalizedAlias)).toContain("상품 담기");
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
    });
    expect(store.proposals[0]).toMatchObject({
      kind: "alias-add",
      normalizedTerm: "없는 용어",
    });
  });
});
