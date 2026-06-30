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

function aliasesForDoc(doc: DocRecord): Array<{ value: string; source: "document" | "deterministic-label"; confidence: number; locale?: string }> {
  const aliases: Array<{ value: string; source: "document" | "deterministic-label"; confidence: number; locale?: string }> = [];
  const seen = new Set<string>();
  const addAlias = (
    value: string,
    source: "document" | "deterministic-label",
    confidence: number,
  ) => {
    if (!value) return;
    const key = `${source}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    aliases.push({
      value,
      source,
      confidence,
      ...(containsKorean(value) ? { locale: "ko" } : {}),
    });
  };

  for (const marker of [doc.purpose, doc.intent, doc.context, doc.caveat]) {
    if (!marker) continue;
    for (const match of marker.matchAll(aliasMarkerPattern)) {
      for (const value of match[1].split(",")) {
        const trimmed = value.trim();
        if (trimmed) addAlias(trimmed, "deterministic-label", 0.85);
      }
    }
  }

  for (const value of [doc.docId, doc.targetPrefix]) {
    if (value) addAlias(value, "document", 0.85);
  }

  for (const value of [doc.svc, ...doc.tags]) {
    if (value) addAlias(value, "document", 0.75);
  }

  return aliases;
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
