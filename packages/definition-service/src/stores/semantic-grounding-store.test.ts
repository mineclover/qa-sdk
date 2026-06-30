import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { SqlSemanticGroundingStore, createSemanticTermId } from "./semantic-grounding-store.js";

function createStore() {
  const raw = new Database(":memory:");
  raw.exec(`
    CREATE TABLE semantic_terms (
      term_id text PRIMARY KEY NOT NULL,
      kind text NOT NULL,
      canonical_label text NOT NULL,
      normalized_label text NOT NULL,
      coordinate text,
      prefix_id text,
      version_id text,
      address integer,
      doc_id text,
      source_path text,
      evidence_json text NOT NULL DEFAULT '{}',
      updated_at text NOT NULL
    );
    CREATE UNIQUE INDEX semantic_terms_identity_unique ON semantic_terms (kind, canonical_label, coordinate, doc_id);
    CREATE INDEX idx_semantic_terms_label ON semantic_terms (normalized_label);
    CREATE INDEX idx_semantic_terms_doc ON semantic_terms (doc_id);
    CREATE INDEX idx_semantic_terms_address ON semantic_terms (prefix_id, version_id, address);

    CREATE TABLE semantic_aliases (
      alias_id text PRIMARY KEY NOT NULL,
      term_id text NOT NULL,
      alias text NOT NULL,
      normalized_alias text NOT NULL,
      locale text,
      source text NOT NULL,
      confidence real NOT NULL,
      created_at text NOT NULL
    );
    CREATE UNIQUE INDEX semantic_aliases_term_alias_source_unique ON semantic_aliases (term_id, normalized_alias, source);
    CREATE INDEX idx_semantic_aliases_alias ON semantic_aliases (normalized_alias);

    CREATE TABLE semantic_relations (
      relation_id text PRIMARY KEY NOT NULL,
      source_term_id text NOT NULL,
      relation_type text NOT NULL,
      target_term_id text NOT NULL,
      evidence_json text NOT NULL DEFAULT '{}'
    );
    CREATE INDEX idx_semantic_relations_source ON semantic_relations (source_term_id);
    CREATE INDEX idx_semantic_relations_target ON semantic_relations (target_term_id);

    CREATE TABLE semantic_grounding_events (
      event_id text PRIMARY KEY NOT NULL,
      query text NOT NULL,
      intent text NOT NULL,
      candidate_json text NOT NULL,
      plan_json text NOT NULL,
      outcome text NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE semantic_feedback_proposals (
      proposal_id text PRIMARY KEY NOT NULL,
      kind text NOT NULL,
      term text NOT NULL,
      normalized_term text NOT NULL,
      dedupe_key text NOT NULL,
      payload_json text NOT NULL DEFAULT '{}',
      evidence_json text NOT NULL DEFAULT '{}',
      status text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );
    CREATE UNIQUE INDEX semantic_feedback_proposals_dedupe_unique ON semantic_feedback_proposals (dedupe_key);
    CREATE INDEX idx_semantic_feedback_status_kind ON semantic_feedback_proposals (status, kind);
  `);
  return new SqlSemanticGroundingStore(drizzle({ client: raw, schema }));
}

describe("SqlSemanticGroundingStore", () => {
  it("upserts terms and aliases, then returns terms with aliases for resolution", () => {
    const store = createStore();
    const termId = createSemanticTermId({
      kind: "document",
      canonicalLabel: "cart add",
      coordinate: "cart_event:v2:10",
      docId: "prefix-cart_event",
    });

    store.upsertTerm({
      termId,
      kind: "document",
      canonicalLabel: "cart add",
      normalizedLabel: "cart add",
      coordinate: "cart_event:v2:10",
      prefixId: "cart_event",
      versionId: "v2",
      address: 10,
      docId: "prefix-cart_event",
      sourcePath: "docs/prefix-cart_event.md",
      evidence: { source: "test" },
      updatedAt: "2026-06-30T00:00:00.000Z",
    });
    store.upsertAlias({
      aliasId: "alias-cart-add-ko",
      termId,
      alias: "상품 담기",
      normalizedAlias: "상품 담기",
      locale: "ko",
      source: "manual",
      confidence: 0.95,
      createdAt: "2026-06-30T00:00:00.000Z",
    });

    const terms = store.listTermsForResolution("상품 담기");
    expect(terms).toHaveLength(1);
    expect(terms[0].termId).toBe(termId);
    expect(terms[0].aliases[0]).toMatchObject({ alias: "상품 담기", confidence: 0.95 });
  });

  it("deduplicates feedback proposals by kind and normalized term", () => {
    const store = createStore();
    const first = store.upsertFeedbackProposal({
      kind: "alias-add",
      term: "상품 담기",
      normalizedTerm: "상품 담기",
      dedupeKey: "alias-add:상품 담기",
      payload: { query: "상품 담기" },
      evidence: { count: 1 },
    });
    const second = store.upsertFeedbackProposal({
      kind: "alias-add",
      term: "상품 담기",
      normalizedTerm: "상품 담기",
      dedupeKey: "alias-add:상품 담기",
      payload: { query: "상품 담기" },
      evidence: { count: 2 },
    });

    expect(second.proposalId).toBe(first.proposalId);
    expect(store.listOpenFeedbackProposals()).toHaveLength(1);
    expect(store.listOpenFeedbackProposals()[0].evidence).toEqual({ count: 2 });
  });
});
