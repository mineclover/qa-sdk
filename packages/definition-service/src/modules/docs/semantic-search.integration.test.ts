import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import * as schema from '../../db/schema.js';
import { SqlDocStore } from '../../stores/doc-store.js';
import { SqlSemanticGroundingStore } from '../../stores/semantic-grounding-store.js';
import type { DocRecord } from '../../core/types.js';
import { normalizeSemanticText } from '../../core/semantic-grounding/normalize.js';
import { DocsService } from './docs.service.js';
import { SemanticGroundingService } from '../semantic-grounding/semantic-grounding.service.js';
import type { SearchService } from '../search/search.service.js';

function createDatabase() {
  const raw = new Database(':memory:');
  raw.exec(`
    CREATE TABLE documents (
      doc_id text PRIMARY KEY NOT NULL,
      title text,
      doc_type text,
      knowledge_kind text,
      level text,
      tier text,
      scope text NOT NULL,
      aspect text NOT NULL,
      depth text NOT NULL,
      lifecycle text NOT NULL,
      target_prefix text,
      layer text,
      tags_json text NOT NULL DEFAULT '[]',
      links_json text NOT NULL DEFAULT '[]',
      svc text,
      doc_version text,
      revision integer,
      address text,
      version integer NOT NULL DEFAULT 1,
      body_hash text NOT NULL,
      body text NOT NULL DEFAULT '',
      purpose text,
      intent text,
      context text,
      caveat text,
      gate_json text,
      synced_at text NOT NULL,
      source_path text
    );
    CREATE TABLE document_history (
      id integer PRIMARY KEY AUTOINCREMENT,
      doc_id text NOT NULL,
      version integer NOT NULL,
      title text,
      doc_type text,
      knowledge_kind text,
      level text,
      tier text,
      scope text NOT NULL,
      aspect text NOT NULL,
      depth text NOT NULL,
      lifecycle text NOT NULL,
      layer text,
      tags_json text NOT NULL,
      links_json text NOT NULL,
      doc_version text,
      revision integer,
      body_hash text NOT NULL,
      body text NOT NULL,
      purpose text,
      intent text,
      context text,
      caveat text,
      gate_json text,
      change_type text NOT NULL,
      synced_at text NOT NULL
    );
    CREATE TABLE document_links (
      source_id text NOT NULL,
      target_id text NOT NULL,
      source_address text,
      target_address text,
      link_type text NOT NULL,
      PRIMARY KEY (source_id, target_id, link_type)
    );
    CREATE TABLE code_references (
      code_path text NOT NULL,
      doc_id text NOT NULL,
      relation_type text NOT NULL,
      source_kind text NOT NULL,
      symbol text NOT NULL DEFAULT '',
      line integer,
      PRIMARY KEY (code_path, doc_id, relation_type, source_kind, symbol)
    );
    CREATE TABLE semantic_terms (
      term_id text PRIMARY KEY NOT NULL,
      kind text NOT NULL,
      canonical_label text NOT NULL,
      normalized_label text NOT NULL,
      coordinate text,
      prefix_id text,
      version text,
      address integer,
      doc_id text,
      source_path text,
      evidence_json text NOT NULL DEFAULT '{}',
      updated_at text NOT NULL
    );
    CREATE UNIQUE INDEX semantic_terms_identity_unique ON semantic_terms (kind, canonical_label, coordinate, doc_id);
    CREATE UNIQUE INDEX semantic_terms_coord_unique ON semantic_terms (prefix_id, version, address, kind, doc_id);
    CREATE INDEX idx_semantic_terms_label ON semantic_terms (normalized_label);
    CREATE INDEX idx_semantic_terms_doc ON semantic_terms (doc_id);
    CREATE INDEX idx_semantic_terms_address ON semantic_terms (prefix_id, version, address);
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
    CREATE INDEX idx_semantic_aliases_term ON semantic_aliases (term_id);
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
  return drizzle({ client: raw, schema });
}

function makeDoc(): DocRecord {
  return {
    docId: 'prefix-cart_event',
    title: 'Cart Event Canonical',
    scope: 'data',
    aspect: 'domain_data',
    depth: 'overview',
    lifecycle: 'approved',
    tags: ['cart'],
    links: [],
    address: 'cart_event:v2:10',
    targetPrefix: 'cart_event',
    version: 1,
    bodyHash: 'hash',
    purpose: 'Canonical cart event document.',
    context: 'aliases: 상품 담기',
    syncedAt: '2026-06-30T00:00:00.000Z',
  };
}

describe('semantic document search integration', () => {
  it('grounds an alias to the canonical document through SQLite semantic tables', () => {
    const db = createDatabase();
    const docStore = new SqlDocStore(db);
    const semanticStore = new SqlSemanticGroundingStore(db);
    const semantic = new SemanticGroundingService(semanticStore);
    const legacyQueries: string[] = [];
    const docs = new DocsService(
      db,
      {
        search(query: string) {
          legacyQueries.push(query);
          return [];
        },
        searchCount(query: string) {
          legacyQueries.push(`${query}:count`);
          return 0;
        },
        index() {},
      } as unknown as SearchService,
      semantic,
    );

    docStore.upsert(makeDoc(), 'Canonical cart event document.');
    const materialized = semantic.materializeDocuments(docStore.list({ limit: 100 }));

    const plan = semantic.planDocumentSearch('상품 담기');
    const result = docs.listPaginated({ q: '상품 담기', limit: 10, offset: 0 });
    const aliasRows = rawRows<{
      alias: string;
      normalized_alias: string;
      source: string;
      locale: string | null;
    }>(
      db,
      'SELECT alias, normalized_alias, source, locale FROM semantic_aliases ORDER BY alias_id',
    );
    const termRows = rawRows<{
      doc_id: string | null;
      canonical_label: string;
      coordinate: string | null;
    }>(db, 'SELECT doc_id, canonical_label, coordinate FROM semantic_terms ORDER BY term_id');
    const eventRows = rawRows<{ query: string; outcome: string }>(
      db,
      'SELECT query, outcome FROM semantic_grounding_events ORDER BY created_at',
    );

    expect(normalizeSemanticText('상품 담기')).toBe('상품 담기');
    expect(materialized).toEqual({ terms: 1, aliases: 4 });
    expect(aliasRows).toHaveLength(4);
    expect(aliasRows).toEqual(
      expect.arrayContaining([
        {
          alias: 'cart',
          normalized_alias: 'cart',
          source: 'document',
          locale: null,
        },
        {
          alias: 'cart_event',
          normalized_alias: 'cart event',
          source: 'document',
          locale: null,
        },
        {
          alias: 'prefix-cart_event',
          normalized_alias: 'prefix cart event',
          source: 'document',
          locale: null,
        },
        {
          alias: '상품 담기',
          normalized_alias: '상품 담기',
          source: 'deterministic-label',
          locale: 'ko',
        },
      ]),
    );
    expect(termRows).toEqual([
      {
        doc_id: 'prefix-cart_event',
        canonical_label: 'Cart Event Canonical',
        coordinate: 'cart_event:v2:10',
      },
    ]);
    expect(plan.candidateDocIds).toEqual(['prefix-cart_event']);
    expect(result.total).toBe(1);
    expect(result.docs.map((item) => item.docId)).toEqual(['prefix-cart_event']);
    expect(eventRows).toEqual([{ query: '상품 담기', outcome: 'semantic-hit' }]);
    expect(legacyQueries).toEqual(['상품 담기', '상품 담기:count']);
  });
});

function rawRows<T>(db: ReturnType<typeof createDatabase>, sql: string): T[] {
  return (db as any).$client.prepare(sql).all() as T[];
}
