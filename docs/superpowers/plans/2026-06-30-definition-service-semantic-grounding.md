# Definition Service Semantic Grounding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SQLite-backed semantic grounding to `definition-service` document search, preserving the existing FTS/LIKE fallback and recording unresolved search terms as feedback proposals.

**Architecture:** Start with a service-local semantic grounding slice. Pure, future-extractable contracts live in `packages/definition-service/src/core/semantic-grounding/`; SQLite stores and NestJS providers live in `packages/definition-service/src/stores/` and `packages/definition-service/src/modules/semantic-grounding/`. `DocsService` keeps the public search API stable while using semantic candidates to rank/scaffold results and record grounding events.

**Tech Stack:** TypeScript, NestJS, Drizzle ORM, SQLite/better-sqlite3, Vitest, existing `definition-service` module/store conventions.

## Global Constraints

- Preserve existing unrelated worktree changes; stage only semantic-grounding plan/implementation files.
- Do not add an in-memory semantic catalog as the primary implementation path; tests may use SQLite `:memory:` through `better-sqlite3`.
- Do not modify `weighted-index` or `index-meta` in this implementation pass.
- Do not introduce vector embeddings or a text-to-SQL generator in this implementation pass.
- Do not auto-promote feedback into axis or prefix changes; unresolved and mismatch signals are stored as proposal rows.
- Existing `/docs?q=...` behavior must keep working when no semantic seed data exists.
- Keep NestJS imports out of `src/core/semantic-grounding/*`.

---

## File Structure

Create this implementation surface:

```txt
packages/definition-service/src/core/semantic-grounding/
  types.ts                 Pure contracts for terms, aliases, candidates, plans, events, proposals.
  normalize.ts             Deterministic query/alias normalization.
  resolver.ts              Candidate ranking over store-provided semantic terms.
  planner.ts               Document-search plan construction and result merge helpers.
  feedback.ts              Proposal constructors and dedupe keys.
  index.ts                 Re-export for core semantic-grounding contracts.

packages/definition-service/src/stores/
  semantic-grounding-store.ts       SQLite-backed store and row mappers.
  semantic-grounding-store.test.ts  Store tests using SQLite :memory: with Drizzle.

packages/definition-service/src/modules/semantic-grounding/
  semantic-grounding.module.ts      Global NestJS module.
  semantic-grounding.service.ts     Store-backed materialize/resolve/plan/record service.

packages/definition-service/src/modules/docs/
  docs.service.ts           Existing search integration point.
  docs.service.test.ts      Service-level search fallback/merge tests with lightweight fakes.

packages/definition-service/src/modules/sync/
  sync.service.ts           Rebuild semantic materialization after doc sync.

packages/definition-service/src/db/schema.ts
packages/definition-service/drizzle/20260630000000_semantic_grounding/migration.sql
packages/definition-service/src/stores/schema.ts
packages/definition-service/src/app.module.ts
```

Keep all type names aligned with the future package extraction surface:

- `SemanticTermRecord`
- `SemanticAliasRecord`
- `SemanticRelationRecord`
- `SemanticCandidate`
- `SemanticResolution`
- `GroundingPlan`
- `SemanticGroundingEventInput`
- `FeedbackProposalRecord`
- `SemanticGroundingStore`

---

### Task 1: Pure Contracts, Normalization, Resolver, Planner

**Files:**
- Create: `packages/definition-service/src/core/semantic-grounding/types.ts`
- Create: `packages/definition-service/src/core/semantic-grounding/normalize.ts`
- Create: `packages/definition-service/src/core/semantic-grounding/resolver.ts`
- Create: `packages/definition-service/src/core/semantic-grounding/planner.ts`
- Create: `packages/definition-service/src/core/semantic-grounding/feedback.ts`
- Create: `packages/definition-service/src/core/semantic-grounding/index.ts`
- Test: `packages/definition-service/src/core/semantic-grounding/normalize.test.ts`
- Test: `packages/definition-service/src/core/semantic-grounding/resolver.test.ts`
- Test: `packages/definition-service/src/core/semantic-grounding/planner.test.ts`

**Interfaces:**
- Consumes: no local semantic code from earlier tasks.
- Produces:
  - `normalizeSemanticText(raw: string): string`
  - `tokenizeSemanticText(raw: string): readonly string[]`
  - `resolveSemanticCandidates(query: string, terms: readonly SemanticTermWithAliases[], options?: SemanticResolveOptions): SemanticResolution`
  - `planDocumentSearch(query: string, resolution: SemanticResolution, options?: GroundingPlannerOptions): GroundingPlan`
  - `mergeSemanticDocumentResults(input: SemanticDocumentMergeInput): readonly DocRecord[]`
  - `buildFeedbackProposal(input: FeedbackProposalInput): FeedbackProposalDraft`

- [ ] **Step 1: Write normalization tests**

Create `packages/definition-service/src/core/semantic-grounding/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeSemanticText, tokenizeSemanticText } from "./normalize.js";

describe("semantic grounding normalization", () => {
  it("normalizes whitespace, case, and punctuation without dropping Korean text", () => {
    expect(normalizeSemanticText("  상품   담기!! ")).toBe("상품 담기");
    expect(normalizeSemanticText("Cart_Add")).toBe("cart add");
    expect(normalizeSemanticText("cart:add-to cart")).toBe("cart add to cart");
  });

  it("tokenizes normalized text into stable unique tokens", () => {
    expect(tokenizeSemanticText("Cart cart 상품 담기")).toEqual(["cart", "상품", "담기"]);
  });
});
```

- [ ] **Step 2: Run normalization tests and verify they fail**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/core/semantic-grounding/normalize.test.ts
```

Expected: FAIL with an import/module-not-found error for `./normalize.js`.

- [ ] **Step 3: Implement normalization helpers**

Create `packages/definition-service/src/core/semantic-grounding/normalize.ts`:

```ts
// @def.doc definition-service

const separatorPattern = /[\s:_./\\|()[\]{}"'`~,;!?<>+=*&^%$#@]+/g;
const dashPattern = /[-]+/g;

export function normalizeSemanticText(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(dashPattern, " ")
    .replace(separatorPattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSemanticText(raw: string): readonly string[] {
  const normalized = normalizeSemanticText(raw);
  if (!normalized) return [];
  return [...new Set(normalized.split(" ").filter(Boolean))];
}
```

- [ ] **Step 4: Write resolver and planner tests**

Create `packages/definition-service/src/core/semantic-grounding/resolver.test.ts`:

```ts
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
```

Create `packages/definition-service/src/core/semantic-grounding/planner.test.ts`:

```ts
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
```

- [ ] **Step 5: Run resolver/planner tests and verify they fail**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/core/semantic-grounding/resolver.test.ts src/core/semantic-grounding/planner.test.ts
```

Expected: FAIL with module-not-found errors for `./resolver.js` and `./planner.js`.

- [ ] **Step 6: Implement pure semantic contracts**

Create `packages/definition-service/src/core/semantic-grounding/types.ts`:

```ts
// @def.doc definition-service

import type { DocRecord } from "../types.js";

export type SemanticTermKind =
  | "document"
  | "prefix"
  | "axis"
  | "entry"
  | "relation"
  | "table"
  | "field"
  | "code";

export interface SemanticAliasRecord {
  readonly aliasId: string;
  readonly termId: string;
  readonly alias: string;
  readonly normalizedAlias: string;
  readonly locale?: string;
  readonly source: "document" | "manual" | "feedback" | "deterministic-label";
  readonly confidence: number;
  readonly createdAt: string;
}

export interface SemanticRelationRecord {
  readonly relationId: string;
  readonly sourceTermId: string;
  readonly relationType: "same-scope" | "depends-on" | "contains" | "refines" | "mentions";
  readonly targetTermId: string;
  readonly evidence: Record<string, unknown>;
}

export interface SemanticTermRecord {
  readonly termId: string;
  readonly kind: SemanticTermKind;
  readonly canonicalLabel: string;
  readonly normalizedLabel: string;
  readonly coordinate?: string;
  readonly prefixId?: string;
  readonly versionId?: string;
  readonly address?: number;
  readonly docId?: string;
  readonly sourcePath?: string;
  readonly evidence: Record<string, unknown>;
  readonly updatedAt: string;
}

export interface SemanticTermWithAliases extends SemanticTermRecord {
  readonly aliases: readonly SemanticAliasRecord[];
  readonly relations: readonly SemanticRelationRecord[];
}

export interface SemanticQuery {
  readonly raw: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
}

export type SemanticCandidateMatch = "canonical-label" | "alias" | "token-overlap" | "relation-neighbor";

export interface SemanticEvidence {
  readonly kind: SemanticCandidateMatch;
  readonly ref: string;
  readonly weight: number;
}

export interface SemanticCandidate {
  readonly termId: string;
  readonly canonicalLabel: string;
  readonly confidence: number;
  readonly matchedBy: SemanticCandidateMatch;
  readonly evidence: readonly SemanticEvidence[];
  readonly docId?: string;
  readonly coordinate?: string;
  readonly prefixId?: string;
  readonly versionId?: string;
  readonly address?: number;
}

export interface SemanticResolveOptions {
  readonly confidenceThreshold?: number;
  readonly limit?: number;
}

export interface SemanticResolution {
  readonly query: SemanticQuery;
  readonly candidates: readonly SemanticCandidate[];
  readonly confident: boolean;
}

export interface GroundingPlannerOptions {
  readonly confidenceThreshold?: number;
  readonly candidateLimit?: number;
}

export interface GroundingPlan {
  readonly kind: "document-search";
  readonly query: string;
  readonly candidateDocIds: readonly string[];
  readonly candidates: readonly SemanticCandidate[];
  readonly fallbackReason?: "empty-query" | "no-candidate" | "no-confident-candidate";
}

export interface SemanticDocumentMergeInput {
  readonly semanticDocs: readonly DocRecord[];
  readonly legacyDocs: readonly DocRecord[];
  readonly candidateDocIds: readonly string[];
  readonly limit: number;
  readonly offset: number;
}

export type FeedbackProposalKind =
  | "alias-add"
  | "entry-add"
  | "axis-promotion"
  | "version-transition"
  | "wrong-scope-or-alias-missing";

export interface FeedbackProposalInput {
  readonly kind: FeedbackProposalKind;
  readonly term: string;
  readonly query?: string;
  readonly evidence?: Record<string, unknown>;
}

export interface FeedbackProposalDraft {
  readonly kind: FeedbackProposalKind;
  readonly term: string;
  readonly normalizedTerm: string;
  readonly dedupeKey: string;
  readonly payload: Record<string, unknown>;
  readonly evidence: Record<string, unknown>;
}

export interface FeedbackProposalRecord extends FeedbackProposalDraft {
  readonly proposalId: string;
  readonly status: "open" | "accepted" | "rejected";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SemanticGroundingEventInput {
  readonly query: string;
  readonly intent: "document-search" | "rag" | "text-to-sql" | "user-search";
  readonly candidates: readonly SemanticCandidate[];
  readonly plan: GroundingPlan;
  readonly outcome: "semantic-hit" | "legacy-fallback" | "no-hit" | "mixed";
}
```

Create `packages/definition-service/src/core/semantic-grounding/resolver.ts`:

```ts
// @def.doc definition-service

import { normalizeSemanticText, tokenizeSemanticText } from "./normalize.js";
import type {
  SemanticCandidate,
  SemanticEvidence,
  SemanticResolution,
  SemanticResolveOptions,
  SemanticTermWithAliases,
} from "./types.js";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;
const DEFAULT_LIMIT = 10;

export function resolveSemanticCandidates(
  query: string,
  terms: readonly SemanticTermWithAliases[],
  options: SemanticResolveOptions = {},
): SemanticResolution {
  const normalized = normalizeSemanticText(query);
  const tokens = tokenizeSemanticText(query);
  const candidates = terms
    .map((term) => scoreTerm(term, normalized, tokens))
    .filter((candidate): candidate is SemanticCandidate => candidate !== null)
    .toSorted((left, right) =>
      right.confidence - left.confidence ||
      left.canonicalLabel.localeCompare(right.canonicalLabel) ||
      left.termId.localeCompare(right.termId),
    )
    .slice(0, options.limit ?? DEFAULT_LIMIT);
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  return {
    query: { raw: query, normalized, tokens },
    candidates,
    confident: candidates.some((candidate) => candidate.confidence >= threshold),
  };
}

function scoreTerm(
  term: SemanticTermWithAliases,
  normalizedQuery: string,
  queryTokens: readonly string[],
): SemanticCandidate | null {
  if (!normalizedQuery) return null;

  const exactAlias = term.aliases.find((alias) => alias.normalizedAlias === normalizedQuery);
  if (exactAlias) {
    return candidate(term, exactAlias.confidence, "alias", [
      { kind: "alias", ref: exactAlias.alias, weight: exactAlias.confidence },
    ]);
  }

  if (term.normalizedLabel === normalizedQuery) {
    return candidate(term, 1, "canonical-label", [
      { kind: "canonical-label", ref: term.canonicalLabel, weight: 1 },
    ]);
  }

  const labelTokens = tokenizeSemanticText(term.normalizedLabel);
  const overlap = queryTokens.filter((token) => labelTokens.includes(token));
  if (overlap.length > 0) {
    const confidence = Math.min(0.75, overlap.length / Math.max(queryTokens.length, labelTokens.length));
    return candidate(term, confidence, "token-overlap", overlap.map((token) => ({
      kind: "token-overlap",
      ref: token,
      weight: confidence,
    })));
  }

  return null;
}

function candidate(
  term: SemanticTermWithAliases,
  confidence: number,
  matchedBy: SemanticCandidate["matchedBy"],
  evidence: readonly SemanticEvidence[],
): SemanticCandidate {
  return {
    termId: term.termId,
    canonicalLabel: term.canonicalLabel,
    confidence,
    matchedBy,
    evidence,
    ...(term.docId ? { docId: term.docId } : {}),
    ...(term.coordinate ? { coordinate: term.coordinate } : {}),
    ...(term.prefixId ? { prefixId: term.prefixId } : {}),
    ...(term.versionId ? { versionId: term.versionId } : {}),
    ...(term.address !== undefined ? { address: term.address } : {}),
  };
}
```

Create `packages/definition-service/src/core/semantic-grounding/planner.ts`:

```ts
// @def.doc definition-service

import type { DocRecord } from "../types.js";
import type {
  GroundingPlan,
  GroundingPlannerOptions,
  SemanticDocumentMergeInput,
  SemanticResolution,
} from "./types.js";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

export function planDocumentSearch(
  query: string,
  resolution: SemanticResolution,
  options: GroundingPlannerOptions = {},
): GroundingPlan {
  if (!resolution.query.normalized) {
    return {
      kind: "document-search",
      query,
      candidateDocIds: [],
      candidates: [],
      fallbackReason: "empty-query",
    };
  }

  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const candidates = resolution.candidates.filter((candidate) => candidate.confidence >= threshold);
  const candidateDocIds = [
    ...new Set(candidates.map((candidate) => candidate.docId).filter((value): value is string => Boolean(value))),
  ];

  return {
    kind: "document-search",
    query,
    candidateDocIds,
    candidates,
    ...(candidates.length === 0
      ? { fallbackReason: resolution.candidates.length === 0 ? "no-candidate" as const : "no-confident-candidate" as const }
      : {}),
  };
}

export function mergeSemanticDocumentResults(input: SemanticDocumentMergeInput): readonly DocRecord[] {
  const order = new Map(input.candidateDocIds.map((docId, index) => [docId, index]));
  const semanticDocs = [...input.semanticDocs].toSorted((left, right) =>
    (order.get(left.docId) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.docId) ?? Number.MAX_SAFE_INTEGER) ||
    left.docId.localeCompare(right.docId),
  );
  const seen = new Set<string>();
  const merged: DocRecord[] = [];

  for (const doc of [...semanticDocs, ...input.legacyDocs]) {
    if (seen.has(doc.docId)) continue;
    seen.add(doc.docId);
    merged.push(doc);
  }

  return merged.slice(input.offset, input.offset + input.limit);
}
```

Create `packages/definition-service/src/core/semantic-grounding/feedback.ts`:

```ts
// @def.doc definition-service

import { normalizeSemanticText } from "./normalize.js";
import type { FeedbackProposalDraft, FeedbackProposalInput } from "./types.js";

export function buildFeedbackProposal(input: FeedbackProposalInput): FeedbackProposalDraft {
  const normalizedTerm = normalizeSemanticText(input.term);
  return {
    kind: input.kind,
    term: input.term,
    normalizedTerm,
    dedupeKey: `${input.kind}:${normalizedTerm}`,
    payload: {
      ...(input.query ? { query: input.query } : {}),
    },
    evidence: input.evidence ?? {},
  };
}
```

Create `packages/definition-service/src/core/semantic-grounding/index.ts`:

```ts
// @def.doc definition-service

export type * from "./types.js";
export { normalizeSemanticText, tokenizeSemanticText } from "./normalize.js";
export { resolveSemanticCandidates } from "./resolver.js";
export { planDocumentSearch, mergeSemanticDocumentResults } from "./planner.js";
export { buildFeedbackProposal } from "./feedback.js";
```

- [ ] **Step 7: Run pure semantic grounding tests**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/core/semantic-grounding/normalize.test.ts src/core/semantic-grounding/resolver.test.ts src/core/semantic-grounding/planner.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/definition-service/src/core/semantic-grounding
git commit -m "feat(definition-service): add semantic grounding core"
```

---

### Task 2: SQLite Schema, Migration, and Store

**Files:**
- Modify: `packages/definition-service/src/db/schema.ts`
- Modify: `packages/definition-service/src/stores/schema.ts`
- Create: `packages/definition-service/drizzle/20260630000000_semantic_grounding/migration.sql`
- Create: `packages/definition-service/src/stores/semantic-grounding-store.ts`
- Test: `packages/definition-service/src/stores/semantic-grounding-store.test.ts`

**Interfaces:**
- Consumes:
  - `SemanticTermRecord`, `SemanticAliasRecord`, `SemanticRelationRecord`, `SemanticTermWithAliases`
  - `SemanticGroundingEventInput`, `FeedbackProposalDraft`, `FeedbackProposalRecord`
- Produces:
  - `SemanticGroundingStore`
  - `SqlSemanticGroundingStore`
  - `createSemanticTermId(input: { kind: string; canonicalLabel: string; coordinate?: string; docId?: string }): string`

- [ ] **Step 1: Write SQLite store tests**

Create `packages/definition-service/src/stores/semantic-grounding-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run store tests and verify they fail**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/stores/semantic-grounding-store.test.ts
```

Expected: FAIL with missing exports for `semantic-grounding-store.js` and missing schema tables.

- [ ] **Step 3: Add Drizzle schema tables**

Append to `packages/definition-service/src/db/schema.ts` after the current table declarations:

```ts
// ── semantic grounding ─────────────────────────────────────────
export const semanticTerms = sqliteTable(
  "semantic_terms",
  {
    termId: text("term_id").primaryKey(),
    kind: text("kind").notNull(),
    canonicalLabel: text("canonical_label").notNull(),
    normalizedLabel: text("normalized_label").notNull(),
    coordinate: text("coordinate"),
    prefixId: text("prefix_id"),
    versionId: text("version_id"),
    address: integer("address"),
    docId: text("doc_id"),
    sourcePath: text("source_path"),
    evidenceJson: text("evidence_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("semantic_terms_identity_unique").on(
      table.kind,
      table.canonicalLabel,
      table.coordinate,
      table.docId,
    ),
    index("idx_semantic_terms_label").on(table.normalizedLabel),
    index("idx_semantic_terms_doc").on(table.docId),
    index("idx_semantic_terms_address").on(table.prefixId, table.versionId, table.address),
  ],
);

export const semanticAliases = sqliteTable(
  "semantic_aliases",
  {
    aliasId: text("alias_id").primaryKey(),
    termId: text("term_id").notNull(),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    locale: text("locale"),
    source: text("source").notNull(),
    confidence: real("confidence").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("semantic_aliases_term_alias_source_unique").on(table.termId, table.normalizedAlias, table.source),
    index("idx_semantic_aliases_alias").on(table.normalizedAlias),
    index("idx_semantic_aliases_term").on(table.termId),
  ],
);

export const semanticRelations = sqliteTable(
  "semantic_relations",
  {
    relationId: text("relation_id").primaryKey(),
    sourceTermId: text("source_term_id").notNull(),
    relationType: text("relation_type").notNull(),
    targetTermId: text("target_term_id").notNull(),
    evidenceJson: text("evidence_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("idx_semantic_relations_source").on(table.sourceTermId),
    index("idx_semantic_relations_target").on(table.targetTermId),
  ],
);

export const semanticGroundingEvents = sqliteTable(
  "semantic_grounding_events",
  {
    eventId: text("event_id").primaryKey(),
    query: text("query").notNull(),
    intent: text("intent").notNull(),
    candidateJson: text("candidate_json", { mode: "json" }).$type<unknown[]>().notNull().default([]),
    planJson: text("plan_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    outcome: text("outcome").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_semantic_grounding_events_created").on(table.createdAt)],
);

export const semanticFeedbackProposals = sqliteTable(
  "semantic_feedback_proposals",
  {
    proposalId: text("proposal_id").primaryKey(),
    kind: text("kind").notNull(),
    term: text("term").notNull(),
    normalizedTerm: text("normalized_term").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payloadJson: text("payload_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    evidenceJson: text("evidence_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("semantic_feedback_proposals_dedupe_unique").on(table.dedupeKey),
    index("idx_semantic_feedback_status_kind").on(table.status, table.kind),
  ],
);

export type SemanticTermRow = typeof semanticTerms.$inferSelect;
export type SemanticAliasRow = typeof semanticAliases.$inferSelect;
export type SemanticRelationRow = typeof semanticRelations.$inferSelect;
export type SemanticFeedbackProposalRow = typeof semanticFeedbackProposals.$inferSelect;
```

Also update the import list near the top of the file if `real` is not already imported. It is already imported in the current file; do not duplicate it.

- [ ] **Step 4: Add migration SQL**

Create `packages/definition-service/drizzle/20260630000000_semantic_grounding/migration.sql`:

```sql
CREATE TABLE IF NOT EXISTS `semantic_terms` (
  `term_id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `canonical_label` text NOT NULL,
  `normalized_label` text NOT NULL,
  `coordinate` text,
  `prefix_id` text,
  `version_id` text,
  `address` integer,
  `doc_id` text,
  `source_path` text,
  `evidence_json` text DEFAULT '{}' NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semantic_terms_identity_unique` ON `semantic_terms` (`kind`, `canonical_label`, `coordinate`, `doc_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_terms_label` ON `semantic_terms` (`normalized_label`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_terms_doc` ON `semantic_terms` (`doc_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_terms_address` ON `semantic_terms` (`prefix_id`, `version_id`, `address`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_aliases` (
  `alias_id` text PRIMARY KEY NOT NULL,
  `term_id` text NOT NULL,
  `alias` text NOT NULL,
  `normalized_alias` text NOT NULL,
  `locale` text,
  `source` text NOT NULL,
  `confidence` real NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semantic_aliases_term_alias_source_unique` ON `semantic_aliases` (`term_id`, `normalized_alias`, `source`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_aliases_alias` ON `semantic_aliases` (`normalized_alias`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_aliases_term` ON `semantic_aliases` (`term_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_relations` (
  `relation_id` text PRIMARY KEY NOT NULL,
  `source_term_id` text NOT NULL,
  `relation_type` text NOT NULL,
  `target_term_id` text NOT NULL,
  `evidence_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_relations_source` ON `semantic_relations` (`source_term_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_relations_target` ON `semantic_relations` (`target_term_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_grounding_events` (
  `event_id` text PRIMARY KEY NOT NULL,
  `query` text NOT NULL,
  `intent` text NOT NULL,
  `candidate_json` text DEFAULT '[]' NOT NULL,
  `plan_json` text DEFAULT '{}' NOT NULL,
  `outcome` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_grounding_events_created` ON `semantic_grounding_events` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `semantic_feedback_proposals` (
  `proposal_id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `term` text NOT NULL,
  `normalized_term` text NOT NULL,
  `dedupe_key` text NOT NULL,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `evidence_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semantic_feedback_proposals_dedupe_unique` ON `semantic_feedback_proposals` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_semantic_feedback_status_kind` ON `semantic_feedback_proposals` (`status`, `kind`);
```

- [ ] **Step 5: Implement SQLite store**

Create `packages/definition-service/src/stores/semantic-grounding-store.ts`:

```ts
// @def.doc definition-service

import { createHash } from "node:crypto";
import { and, eq, inArray, like, or } from "drizzle-orm";
import type { DefinitionServiceDatabase } from "../database.module.js";
import {
  semanticAliases,
  semanticFeedbackProposals,
  semanticGroundingEvents,
  semanticRelations,
  semanticTerms,
} from "../db/schema.js";
import { normalizeSemanticText, tokenizeSemanticText } from "../core/semantic-grounding/normalize.js";
import type {
  FeedbackProposalDraft,
  FeedbackProposalRecord,
  SemanticAliasRecord,
  SemanticGroundingEventInput,
  SemanticRelationRecord,
  SemanticTermRecord,
  SemanticTermWithAliases,
} from "../core/semantic-grounding/types.js";

export interface SemanticGroundingStore {
  upsertTerm(record: SemanticTermRecord): void;
  deleteTermsForDoc(docId: string): void;
  upsertAlias(record: SemanticAliasRecord): void;
  upsertRelation(record: SemanticRelationRecord): void;
  listTermsForResolution(query: string, limit?: number): SemanticTermWithAliases[];
  listTermsByDocIds(docIds: readonly string[]): SemanticTermWithAliases[];
  recordGroundingEvent(input: SemanticGroundingEventInput): string;
  upsertFeedbackProposal(input: FeedbackProposalDraft): FeedbackProposalRecord;
  listOpenFeedbackProposals(): FeedbackProposalRecord[];
}

export function createSemanticTermId(input: {
  readonly kind: string;
  readonly canonicalLabel: string;
  readonly coordinate?: string;
  readonly docId?: string;
}): string {
  const hash = createHash("sha1")
    .update([input.kind, input.canonicalLabel, input.coordinate ?? "", input.docId ?? ""].join("\u001f"))
    .digest("hex")
    .slice(0, 16);
  return `sem-term-${hash}`;
}

export class SqlSemanticGroundingStore implements SemanticGroundingStore {
  constructor(private readonly db: DefinitionServiceDatabase) {}

  upsertTerm(record: SemanticTermRecord): void {
    this.db
      .insert(semanticTerms)
      .values({
        termId: record.termId,
        kind: record.kind,
        canonicalLabel: record.canonicalLabel,
        normalizedLabel: record.normalizedLabel,
        coordinate: record.coordinate ?? null,
        prefixId: record.prefixId ?? null,
        versionId: record.versionId ?? null,
        address: record.address ?? null,
        docId: record.docId ?? null,
        sourcePath: record.sourcePath ?? null,
        evidenceJson: record.evidence,
        updatedAt: record.updatedAt,
      })
      .onConflictDoUpdate({
        target: semanticTerms.termId,
        set: {
          canonicalLabel: record.canonicalLabel,
          normalizedLabel: record.normalizedLabel,
          coordinate: record.coordinate ?? null,
          prefixId: record.prefixId ?? null,
          versionId: record.versionId ?? null,
          address: record.address ?? null,
          docId: record.docId ?? null,
          sourcePath: record.sourcePath ?? null,
          evidenceJson: record.evidence,
          updatedAt: record.updatedAt,
        },
      })
      .run();
  }

  deleteTermsForDoc(docId: string): void {
    const rows = this.db.select({ termId: semanticTerms.termId }).from(semanticTerms).where(eq(semanticTerms.docId, docId)).all();
    const termIds = rows.map((row) => row.termId);
    if (termIds.length === 0) return;
    this.db.delete(semanticAliases).where(inArray(semanticAliases.termId, termIds)).run();
    this.db.delete(semanticRelations).where(or(inArray(semanticRelations.sourceTermId, termIds), inArray(semanticRelations.targetTermId, termIds))).run();
    this.db.delete(semanticTerms).where(inArray(semanticTerms.termId, termIds)).run();
  }

  upsertAlias(record: SemanticAliasRecord): void {
    this.db
      .insert(semanticAliases)
      .values({
        aliasId: record.aliasId,
        termId: record.termId,
        alias: record.alias,
        normalizedAlias: record.normalizedAlias,
        locale: record.locale ?? null,
        source: record.source,
        confidence: record.confidence,
        createdAt: record.createdAt,
      })
      .onConflictDoUpdate({
        target: semanticAliases.aliasId,
        set: {
          alias: record.alias,
          normalizedAlias: record.normalizedAlias,
          locale: record.locale ?? null,
          source: record.source,
          confidence: record.confidence,
        },
      })
      .run();
  }

  upsertRelation(record: SemanticRelationRecord): void {
    this.db
      .insert(semanticRelations)
      .values({
        relationId: record.relationId,
        sourceTermId: record.sourceTermId,
        relationType: record.relationType,
        targetTermId: record.targetTermId,
        evidenceJson: record.evidence,
      })
      .onConflictDoUpdate({
        target: semanticRelations.relationId,
        set: {
          relationType: record.relationType,
          targetTermId: record.targetTermId,
          evidenceJson: record.evidence,
        },
      })
      .run();
  }

  listTermsForResolution(query: string, limit = 200): SemanticTermWithAliases[] {
    const normalized = normalizeSemanticText(query);
    const tokens = tokenizeSemanticText(query);
    const patterns = [normalized, ...tokens].filter(Boolean).map((token) => `%${token}%`);
    if (patterns.length === 0) return [];

    const termIds = new Set<string>();
    for (const pattern of patterns) {
      const termRows = this.db
        .select({ termId: semanticTerms.termId })
        .from(semanticTerms)
        .where(like(semanticTerms.normalizedLabel, pattern))
        .limit(limit)
        .all();
      const aliasRows = this.db
        .select({ termId: semanticAliases.termId })
        .from(semanticAliases)
        .where(like(semanticAliases.normalizedAlias, pattern))
        .limit(limit)
        .all();
      for (const row of [...termRows, ...aliasRows]) termIds.add(row.termId);
    }

    return this.listTermsByIds([...termIds].slice(0, limit));
  }

  listTermsByDocIds(docIds: readonly string[]): SemanticTermWithAliases[] {
    if (docIds.length === 0) return [];
    const rows = this.db.select({ termId: semanticTerms.termId }).from(semanticTerms).where(inArray(semanticTerms.docId, [...docIds])).all();
    return this.listTermsByIds(rows.map((row) => row.termId));
  }

  recordGroundingEvent(input: SemanticGroundingEventInput): string {
    const eventId = `sem-event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.db.insert(semanticGroundingEvents).values({
      eventId,
      query: input.query,
      intent: input.intent,
      candidateJson: [...input.candidates],
      planJson: input.plan as unknown as Record<string, unknown>,
      outcome: input.outcome,
      createdAt: new Date().toISOString(),
    }).run();
    return eventId;
  }

  upsertFeedbackProposal(input: FeedbackProposalDraft): FeedbackProposalRecord {
    const now = new Date().toISOString();
    const existing = this.db
      .select()
      .from(semanticFeedbackProposals)
      .where(eq(semanticFeedbackProposals.dedupeKey, input.dedupeKey))
      .get();
    const proposalId = existing?.proposalId ?? `sem-proposal-${createHash("sha1").update(input.dedupeKey).digest("hex").slice(0, 16)}`;

    this.db
      .insert(semanticFeedbackProposals)
      .values({
        proposalId,
        kind: input.kind,
        term: input.term,
        normalizedTerm: input.normalizedTerm,
        dedupeKey: input.dedupeKey,
        payloadJson: input.payload,
        evidenceJson: input.evidence,
        status: existing?.status ?? "open",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: semanticFeedbackProposals.dedupeKey,
        set: {
          term: input.term,
          payloadJson: input.payload,
          evidenceJson: input.evidence,
          updatedAt: now,
        },
      })
      .run();

    return this.listOpenFeedbackProposals().find((item) => item.proposalId === proposalId)
      ?? {
        proposalId,
        status: "open",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...input,
      };
  }

  listOpenFeedbackProposals(): FeedbackProposalRecord[] {
    return this.db
      .select()
      .from(semanticFeedbackProposals)
      .where(eq(semanticFeedbackProposals.status, "open"))
      .all()
      .map((row) => ({
        proposalId: row.proposalId,
        kind: row.kind as FeedbackProposalRecord["kind"],
        term: row.term,
        normalizedTerm: row.normalizedTerm,
        dedupeKey: row.dedupeKey,
        payload: row.payloadJson,
        evidence: row.evidenceJson,
        status: row.status as FeedbackProposalRecord["status"],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  }

  private listTermsByIds(termIds: readonly string[]): SemanticTermWithAliases[] {
    if (termIds.length === 0) return [];
    const terms = this.db.select().from(semanticTerms).where(inArray(semanticTerms.termId, [...termIds])).all();
    const aliases = this.db.select().from(semanticAliases).where(inArray(semanticAliases.termId, [...termIds])).all();
    const relations = this.db
      .select()
      .from(semanticRelations)
      .where(or(inArray(semanticRelations.sourceTermId, [...termIds]), inArray(semanticRelations.targetTermId, [...termIds])))
      .all();

    return terms.map((term) => ({
      termId: term.termId,
      kind: term.kind as SemanticTermWithAliases["kind"],
      canonicalLabel: term.canonicalLabel,
      normalizedLabel: term.normalizedLabel,
      ...(term.coordinate ? { coordinate: term.coordinate } : {}),
      ...(term.prefixId ? { prefixId: term.prefixId } : {}),
      ...(term.versionId ? { versionId: term.versionId } : {}),
      ...(term.address !== null ? { address: term.address } : {}),
      ...(term.docId ? { docId: term.docId } : {}),
      ...(term.sourcePath ? { sourcePath: term.sourcePath } : {}),
      evidence: term.evidenceJson,
      updatedAt: term.updatedAt,
      aliases: aliases.filter((alias) => alias.termId === term.termId).map((alias) => ({
        aliasId: alias.aliasId,
        termId: alias.termId,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        ...(alias.locale ? { locale: alias.locale } : {}),
        source: alias.source as SemanticAliasRecord["source"],
        confidence: alias.confidence,
        createdAt: alias.createdAt,
      })),
      relations: relations
        .filter((relation) => relation.sourceTermId === term.termId || relation.targetTermId === term.termId)
        .map((relation) => ({
          relationId: relation.relationId,
          sourceTermId: relation.sourceTermId,
          relationType: relation.relationType as SemanticRelationRecord["relationType"],
          targetTermId: relation.targetTermId,
          evidence: relation.evidenceJson,
        })),
    }));
  }
}
```

- [ ] **Step 6: Export schema tables through compatibility module**

Modify `packages/definition-service/src/stores/schema.ts` to include the new tables:

```ts
export {
  prefixRegistry,
  documents,
  documentLinks,
  documentHistory,
  sliceIntents,
  consumptionSnapshots,
  testRegistry,
  testResults,
  semanticTerms,
  semanticAliases,
  semanticRelations,
  semanticGroundingEvents,
  semanticFeedbackProposals,
} from "../db/schema.js";
```

- [ ] **Step 7: Run SQLite store tests**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/stores/semantic-grounding-store.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run definition-service typecheck**

Run:

```bash
pnpm --filter @qa-sdk/definition-service typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add packages/definition-service/src/db/schema.ts \
  packages/definition-service/src/stores/schema.ts \
  packages/definition-service/drizzle/20260630000000_semantic_grounding/migration.sql \
  packages/definition-service/src/stores/semantic-grounding-store.ts \
  packages/definition-service/src/stores/semantic-grounding-store.test.ts
git commit -m "feat(definition-service): add semantic grounding store"
```

---

### Task 3: Semantic Grounding Service and Materializer

**Files:**
- Create: `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.module.ts`
- Create: `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.ts`
- Test: `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts`
- Modify: `packages/definition-service/src/app.module.ts`

**Interfaces:**
- Consumes:
  - `SqlSemanticGroundingStore`
  - `resolveSemanticCandidates`
  - `planDocumentSearch`
  - `buildFeedbackProposal`
- Produces:
  - `SemanticGroundingService.materializeDocuments(docs: readonly DocRecord[]): { terms: number; aliases: number }`
  - `SemanticGroundingService.resolve(query: string): SemanticResolution`
  - `SemanticGroundingService.planDocumentSearch(query: string): GroundingPlan`
  - `SemanticGroundingService.recordDocumentSearch(input: { query: string; plan: GroundingPlan; docs: readonly DocRecord[]; legacyCount: number }): void`
  - `SemanticGroundingService.listTermsByDocIds(docIds: readonly string[]): SemanticTermWithAliases[]`

- [ ] **Step 1: Write service materialization tests**

Create `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/modules/semantic-grounding/semantic-grounding.service.test.ts
```

Expected: FAIL with module-not-found for `semantic-grounding.service.js`.

- [ ] **Step 3: Implement semantic grounding service**

Create `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.ts`:

```ts
// @def.doc definition-service
// @def.boundary definition-service-system

import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE_DB, type DefinitionServiceDatabase } from "../../database.module.js";
import type { DocRecord } from "../../core/types.js";
import {
  buildFeedbackProposal,
  normalizeSemanticText,
  planDocumentSearch,
  resolveSemanticCandidates,
  type GroundingPlan,
  type SemanticResolution,
  type SemanticTermWithAliases,
} from "../../core/semantic-grounding/index.js";
import {
  SqlSemanticGroundingStore,
  createSemanticTermId,
  type SemanticGroundingStore,
} from "../../stores/semantic-grounding-store.js";

const aliasMarkerPattern = /(?:alias|aliases)\s*:\s*([^.;\n]+)/gi;
const addressPattern = /^([^:]+):([^:]+):(\d+)$/;

@Injectable()
export class SemanticGroundingService {
  private readonly store: SemanticGroundingStore;

  constructor(@Inject(DRIZZLE_DB) dbOrStore: DefinitionServiceDatabase | SemanticGroundingStore) {
    this.store = isSemanticGroundingStore(dbOrStore)
      ? dbOrStore
      : new SqlSemanticGroundingStore(dbOrStore);
  }

  materializeDocuments(docs: readonly DocRecord[]): { terms: number; aliases: number } {
    let terms = 0;
    let aliases = 0;
    const now = new Date().toISOString();

    for (const doc of docs) {
      this.store.deleteTermsForDoc(doc.docId);
      const canonicalLabel = doc.title || doc.docId;
      const parsedAddress = parseCoordinate(doc.address);
      const termId = createSemanticTermId({
        kind: "document",
        canonicalLabel,
        coordinate: doc.address,
        docId: doc.docId,
      });

      this.store.upsertTerm({
        termId,
        kind: "document",
        canonicalLabel,
        normalizedLabel: normalizeSemanticText(canonicalLabel),
        ...(doc.address ? { coordinate: doc.address } : {}),
        ...(doc.targetPrefix ? { prefixId: doc.targetPrefix } : parsedAddress?.prefixId ? { prefixId: parsedAddress.prefixId } : {}),
        ...(parsedAddress?.versionId ? { versionId: parsedAddress.versionId } : {}),
        ...(parsedAddress?.address !== undefined ? { address: parsedAddress.address } : {}),
        docId: doc.docId,
        ...(doc.sourcePath ? { sourcePath: doc.sourcePath } : {}),
        evidence: {
          source: "definition-service.documents",
          tags: doc.tags,
          svc: doc.svc,
        },
        updatedAt: now,
      });
      terms++;

      for (const alias of aliasesForDoc(doc)) {
        const normalizedAlias = normalizeSemanticText(alias.value);
        if (!normalizedAlias || normalizedAlias === normalizeSemanticText(canonicalLabel)) continue;
        this.store.upsertAlias({
          aliasId: `sem-alias-${termId}-${hashAlias(normalizedAlias)}`,
          termId,
          alias: alias.value,
          normalizedAlias,
          ...(alias.locale ? { locale: alias.locale } : {}),
          source: alias.source,
          confidence: alias.confidence,
          createdAt: now,
        });
        aliases++;
      }
    }

    return { terms, aliases };
  }

  resolve(query: string): SemanticResolution {
    return resolveSemanticCandidates(query, this.store.listTermsForResolution(query));
  }

  planDocumentSearch(query: string): GroundingPlan {
    return planDocumentSearch(query, this.resolve(query));
  }

  listTermsByDocIds(docIds: readonly string[]): SemanticTermWithAliases[] {
    return this.store.listTermsByDocIds(docIds);
  }

  recordDocumentSearch(input: {
    readonly query: string;
    readonly plan: GroundingPlan;
    readonly docs: readonly DocRecord[];
    readonly legacyCount: number;
  }): void {
    const outcome = input.docs.length > 0 && input.plan.candidates.length > 0
      ? input.legacyCount > 0 ? "mixed" as const : "semantic-hit" as const
      : input.legacyCount > 0 ? "legacy-fallback" as const : "no-hit" as const;
    this.store.recordGroundingEvent({
      query: input.query,
      intent: "document-search",
      candidates: input.plan.candidates,
      plan: input.plan,
      outcome,
    });

    if (input.plan.fallbackReason || input.docs.length === 0) {
      this.store.upsertFeedbackProposal(buildFeedbackProposal({
        kind: "alias-add",
        term: input.query,
        query: input.query,
        evidence: {
          fallbackReason: input.plan.fallbackReason ?? "no-hit",
          legacyCount: input.legacyCount,
        },
      }));
    }
  }
}

function aliasesForDoc(doc: DocRecord): Array<{ value: string; source: "document"; confidence: number; locale?: string }> {
  const values = new Set<string>();
  for (const value of [doc.docId, doc.targetPrefix, doc.svc, ...doc.tags]) {
    if (value) values.add(value);
  }
  for (const marker of [doc.purpose, doc.intent, doc.context, doc.caveat]) {
    if (!marker) continue;
    for (const match of marker.matchAll(aliasMarkerPattern)) {
      for (const value of match[1].split(",")) {
        const trimmed = value.trim();
        if (trimmed) values.add(trimmed);
      }
    }
  }
  return [...values].map((value) => ({
    value,
    source: "document" as const,
    confidence: value === doc.docId || value === doc.targetPrefix ? 0.85 : 0.75,
    ...(containsKorean(value) ? { locale: "ko" } : {}),
  }));
}

function containsKorean(value: string): boolean {
  return /[가-힣]/.test(value);
}

function parseCoordinate(value?: string): { prefixId: string; versionId: string; address: number } | null {
  if (!value) return null;
  const match = value.match(addressPattern);
  if (!match) return null;
  return { prefixId: match[1], versionId: match[2], address: Number(match[3]) };
}

function hashAlias(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function isSemanticGroundingStore(value: unknown): value is SemanticGroundingStore {
  return Boolean(
    value &&
    typeof value === "object" &&
    "listTermsForResolution" in value &&
    "upsertFeedbackProposal" in value,
  );
}
```

- [ ] **Step 4: Add global module and AppModule import**

Create `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.module.ts`:

```ts
// @def.doc definition-service

import { Global, Module } from "@nestjs/common";
import { SemanticGroundingService } from "./semantic-grounding.service.js";

@Global()
@Module({
  providers: [SemanticGroundingService],
  exports: [SemanticGroundingService],
})
export class SemanticGroundingModule {}
```

Modify `packages/definition-service/src/app.module.ts`:

```ts
import { SemanticGroundingModule } from "./modules/semantic-grounding/semantic-grounding.module.js";
```

Then add `SemanticGroundingModule` to the `imports` list after `DatabaseModule`:

```ts
  imports: [
    DatabaseModule,
    SemanticGroundingModule,
    SearchModule,
    GraphQLModule.forRoot<MercuriusDriverConfig>({
```

- [ ] **Step 5: Run semantic grounding service tests**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/modules/semantic-grounding/semantic-grounding.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --filter @qa-sdk/definition-service typecheck
```

Expected: PASS. If the constructor union causes NestJS metadata typing issues, split the service constructor to `constructor(@Inject(DRIZZLE_DB) db: DefinitionServiceDatabase)` and add a static test helper `SemanticGroundingService.fromStore(store: SemanticGroundingStore)` for unit tests.

- [ ] **Step 7: Commit Task 3**

```bash
git add packages/definition-service/src/modules/semantic-grounding \
  packages/definition-service/src/app.module.ts
git commit -m "feat(definition-service): add semantic grounding service"
```

---

### Task 4: Integrate Semantic Grounding into Document Search

**Files:**
- Modify: `packages/definition-service/src/modules/docs/docs.service.ts`
- Test: `packages/definition-service/src/modules/docs/docs.service.test.ts`

**Interfaces:**
- Consumes:
  - `SemanticGroundingService.planDocumentSearch(query)`
  - `SemanticGroundingService.recordDocumentSearch(input)`
  - `mergeSemanticDocumentResults(input)`
- Produces:
  - Existing `DocsService.list(filter?: DocListFilter): DocRecord[]` behavior with semantic merge when `filter.q` exists.
  - Existing `DocsService.listPaginated(filter?: DocListFilter): DocListResult` behavior with semantic merge and legacy count.

- [ ] **Step 1: Write DocsService search integration tests**

Create `packages/definition-service/src/modules/docs/docs.service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DocRecord } from "../../core/types.js";
import { mergeSemanticDocumentResults } from "../../core/semantic-grounding/planner.js";

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

describe("DocsService semantic search merge", () => {
  it("keeps semantic candidate docs before legacy FTS docs and removes duplicates", () => {
    const result = mergeSemanticDocumentResults({
      semanticDocs: [doc("semantic-b"), doc("semantic-a")],
      legacyDocs: [doc("semantic-a"), doc("legacy-c")],
      candidateDocIds: ["semantic-a", "semantic-b"],
      limit: 10,
      offset: 0,
    });

    expect(result.map((item) => item.docId)).toEqual(["semantic-a", "semantic-b", "legacy-c"]);
  });

  it("applies pagination after semantic and legacy results are merged", () => {
    const result = mergeSemanticDocumentResults({
      semanticDocs: [doc("semantic-a"), doc("semantic-b")],
      legacyDocs: [doc("legacy-c")],
      candidateDocIds: ["semantic-a", "semantic-b"],
      limit: 1,
      offset: 1,
    });

    expect(result.map((item) => item.docId)).toEqual(["semantic-b"]);
  });
});
```

- [ ] **Step 2: Run DocsService merge tests**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/modules/docs/docs.service.test.ts
```

Expected: PASS because Task 1 already implemented `mergeSemanticDocumentResults`.

- [ ] **Step 3: Modify DocsService constructor**

In `packages/definition-service/src/modules/docs/docs.service.ts`, add the import:

```ts
import { SemanticGroundingService } from "../semantic-grounding/semantic-grounding.service.js";
import { mergeSemanticDocumentResults } from "../../core/semantic-grounding/planner.js";
```

Change the constructor:

```ts
  constructor(
    @Inject(DRIZZLE_DB) db: DefinitionServiceDatabase,
    @Optional() @Inject(SearchService) private readonly search?: SearchService,
    @Optional() @Inject(SemanticGroundingService) private readonly semantic?: SemanticGroundingService,
  ) {
    this.store = new SqlDocStore(db);
  }
```

- [ ] **Step 4: Add semantic-aware private search helper**

In `DocsService`, add:

```ts
  private searchWithSemanticGrounding(query: string, limit: number, offset: number): DocRecord[] {
    const legacyDocs = this.search?.search(query, Math.max(limit + offset, 50), 0) ?? [];
    if (!this.semantic) return legacyDocs.slice(offset, offset + limit);

    const plan = this.semantic.planDocumentSearch(query);
    const semanticDocs = plan.candidateDocIds.length > 0
      ? this.store.list({ limit: 10000 }).filter((doc) => plan.candidateDocIds.includes(doc.docId))
      : [];
    const merged = mergeSemanticDocumentResults({
      semanticDocs,
      legacyDocs,
      candidateDocIds: plan.candidateDocIds,
      limit,
      offset,
    });
    this.semantic.recordDocumentSearch({
      query,
      plan,
      docs: merged,
      legacyCount: legacyDocs.length,
    });
    return [...merged];
  }

  private semanticSearchCount(query: string): number {
    const legacyCount = this.search?.searchCount(query) ?? 0;
    if (!this.semantic) return legacyCount;
    const plan = this.semantic.planDocumentSearch(query);
    const semanticCount = new Set(plan.candidateDocIds).size;
    return Math.max(legacyCount, semanticCount);
  }
```

- [ ] **Step 5: Route list and listPaginated through semantic helper**

Replace the `filter?.q && this.search` branches in `list()` and `listPaginated()` with:

```ts
    if (filter?.q && this.search) {
      return this.searchWithSemanticGrounding(filter.q, filter?.limit ?? 50, filter?.offset ?? 0);
    }
```

and:

```ts
    if (filter?.q && this.search) {
      const docs = this.searchWithSemanticGrounding(filter.q, limit, offset);
      const total = this.semanticSearchCount(filter.q);
      return { docs, total, offset, limit };
    }
```

- [ ] **Step 6: Keep metadata updates materialized**

In `updateMetadata`, after reindexing the search document, add:

```ts
      if (doc) this.semantic?.materializeDocuments([doc]);
```

The resulting block should be:

```ts
    if (result && result.action === "updated") {
      const doc = this.store.get(docId);
      if (doc) this.search?.index(docId, doc.purpose, doc.intent, doc.context, doc.caveat);
      if (doc) this.semantic?.materializeDocuments([doc]);
    }
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/modules/docs/docs.service.test.ts src/core/semantic-grounding/planner.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run typecheck**

Run:

```bash
pnpm --filter @qa-sdk/definition-service typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```bash
git add packages/definition-service/src/modules/docs/docs.service.ts \
  packages/definition-service/src/modules/docs/docs.service.test.ts
git commit -m "feat(definition-service): ground document search"
```

---

### Task 5: Rebuild Semantic Materialization During Sync

**Files:**
- Modify: `packages/definition-service/src/modules/sync/sync.service.ts`
- Test: `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts`

**Interfaces:**
- Consumes:
  - `SemanticGroundingService.materializeDocuments(docs)`
- Produces:
  - Sync flow rebuilds FTS and semantic grounding from the same document snapshot.

- [ ] **Step 1: Extend service test for replacement semantics**

Append to `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts`:

```ts
  it("replaces stale document terms when a document is rematerialized", () => {
    const store = new FakeStore();
    const service = new SemanticGroundingService(store);
    const first = doc();
    service.materializeDocuments([first]);
    expect([...store.terms.values()][0].canonicalLabel).toBe("Cart Event");

    service.materializeDocuments([{ ...first, title: "Cart Event Updated", tags: ["updated"] }]);

    const terms = [...store.terms.values()];
    expect(terms).toHaveLength(1);
    expect(terms[0].canonicalLabel).toBe("Cart Event Updated");
    expect(store.aliases.some((alias) => alias.normalizedAlias === "updated")).toBe(true);
  });
```

- [ ] **Step 2: Run service tests**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/modules/semantic-grounding/semantic-grounding.service.test.ts
```

Expected: PASS.

- [ ] **Step 3: Inject SemanticGroundingService into SyncService**

In `packages/definition-service/src/modules/sync/sync.service.ts`, add import:

```ts
import { SemanticGroundingService } from "../semantic-grounding/semantic-grounding.service.js";
```

Update the constructor:

```ts
  constructor(
    @Inject(DocsService) private readonly docs: DocsService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(SemanticGroundingService) private readonly semantic: SemanticGroundingService,
    @Inject(DRIZZLE_DB) private readonly db: DefinitionServiceDatabase,
  ) {}
```

- [ ] **Step 4: Rebuild semantic grounding after FTS index rebuild**

Change `rebuildSearchIndex()` to return the indexed documents:

```ts
  private rebuildSearchIndex(): DocRecord[] {
    const allDocs = this.docs.list({ limit: 10000 });
    let indexed = 0;
    for (const doc of allDocs) {
      this.search.index(doc.docId, doc.purpose, doc.intent, doc.context, doc.caveat);
      indexed++;
    }
    logger.info({ indexed }, "검색 인덱스 재구축 완료");
    return allDocs;
  }
```

Add `DocRecord` import at the top:

```ts
import type { DocRecord } from "../../core/types.js";
```

Then update `run()`:

```ts
    const allDocs = this.rebuildSearchIndex(); // @facet.hierarchy core
    const semanticReport = this.semantic.materializeDocuments(allDocs);
    logger.info(semanticReport, "semantic grounding materialization 완료");
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @qa-sdk/definition-service typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add packages/definition-service/src/modules/sync/sync.service.ts \
  packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts
git commit -m "feat(definition-service): materialize semantic grounding on sync"
```

---

### Task 6: End-to-End Semantic Search Regression

**Files:**
- Create: `packages/definition-service/src/modules/docs/semantic-search.integration.test.ts`

**Interfaces:**
- Consumes:
  - `SqlSemanticGroundingStore`
  - `SemanticGroundingService`
  - `DocsService` semantic search integration
- Produces:
  - A regression proving alias-driven semantic search can return a document even when legacy text search alone would not find it.

- [ ] **Step 1: Write integration test**

Create `packages/definition-service/src/modules/docs/semantic-search.integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema.js";
import { SqlDocStore } from "../../stores/doc-store.js";
import { SqlSemanticGroundingStore } from "../../stores/semantic-grounding-store.js";
import { SemanticGroundingService } from "../semantic-grounding/semantic-grounding.service.js";
import type { DocRecord } from "../../core/types.js";
import { normalizeSemanticText } from "../../core/semantic-grounding/normalize.js";

function createDatabase() {
  const raw = new Database(":memory:");
  raw.exec(`
    CREATE TABLE documents (
      doc_id text PRIMARY KEY NOT NULL,
      title text,
      doc_type text,
      knowledge_kind text,
      level text,
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
      PRIMARY KEY(source_id, target_id, link_type)
    );
    CREATE TABLE code_references (
      code_path text NOT NULL,
      doc_id text NOT NULL,
      relation_type text NOT NULL,
      source_kind text NOT NULL,
      symbol text NOT NULL DEFAULT '',
      line integer,
      PRIMARY KEY(code_path, doc_id, relation_type, source_kind, symbol)
    );
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
    CREATE TABLE semantic_relations (
      relation_id text PRIMARY KEY NOT NULL,
      source_term_id text NOT NULL,
      relation_type text NOT NULL,
      target_term_id text NOT NULL,
      evidence_json text NOT NULL DEFAULT '{}'
    );
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
  `);
  return drizzle({ client: raw, schema });
}

function doc(): DocRecord {
  return {
    docId: "prefix-cart_event",
    title: "Cart Event Canonical",
    scope: "data",
    aspect: "domain_data",
    depth: "overview",
    lifecycle: "approved",
    tags: ["cart"],
    links: [],
    address: "cart_event:v2:10",
    targetPrefix: "cart_event",
    version: 1,
    bodyHash: "hash",
    purpose: "Canonical cart event document.",
    context: "aliases: 상품 담기",
    syncedAt: "2026-06-30T00:00:00.000Z",
  };
}

describe("semantic document search integration", () => {
  it("grounds an alias to the canonical document through SQLite semantic tables", () => {
    const db = createDatabase();
    const docs = new SqlDocStore(db);
    docs.upsert(doc(), "Canonical cart event document.");

    const semantic = new SemanticGroundingService(new SqlSemanticGroundingStore(db));
    semantic.materializeDocuments(docs.list({ limit: 100 }));

    const plan = semantic.planDocumentSearch("상품 담기");
    const semanticDocs = docs.list({ limit: 100 }).filter((item) => plan.candidateDocIds.includes(item.docId));

    expect(normalizeSemanticText("상품 담기")).toBe("상품 담기");
    expect(plan.candidateDocIds).toEqual(["prefix-cart_event"]);
    expect(semanticDocs.map((item) => item.docId)).toEqual(["prefix-cart_event"]);
  });
});
```

- [ ] **Step 2: Run integration test**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test src/modules/docs/semantic-search.integration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full definition-service tests**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test
```

Expected: PASS.

- [ ] **Step 4: Commit Task 6**

```bash
git add packages/definition-service/src/modules/docs/semantic-search.integration.test.ts
git commit -m "test(definition-service): cover semantic document search"
```

---

### Task 7: Package-Level Verification and Architecture Feedback

**Files:**
- Modify if needed: `packages/definition-service/README.md`
- No code creation expected unless verification exposes a documentation gap.

**Interfaces:**
- Consumes all previous tasks.
- Produces final verified semantic grounding implementation.

- [ ] **Step 1: Run focused package checks**

Run:

```bash
pnpm --filter @qa-sdk/definition-service test
pnpm --filter @qa-sdk/definition-service typecheck
```

Expected: both PASS.

- [ ] **Step 2: Run formatting/diff hygiene**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 3: Run architecture feedback**

Run:

```bash
pnpm arch:feedback
```

Expected: PASS. If it reports a tier violation caused by `definition-service` importing a lower-level or same-level package incorrectly, fix the import direction inside `definition-service`; do not move code into `weighted-index` or `index-meta`.

- [ ] **Step 4: Inspect final changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only semantic grounding implementation files and the existing unrelated WIP should appear. Do not stage unrelated WIP.

- [ ] **Step 5: Commit final verification/docs adjustment if needed**

If `packages/definition-service/README.md` was changed:

```bash
git add packages/definition-service/README.md
git commit -m "docs(definition-service): document semantic grounding"
```

If no docs were changed, skip this commit step.
