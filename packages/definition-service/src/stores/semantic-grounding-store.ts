// @def.doc definition-service

import { createHash } from "node:crypto";
import { asc, eq, inArray, isNotNull, like, or } from "drizzle-orm";
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
  SemanticGroundingRuntimeSnapshot,
  SemanticRelationRecord,
  SemanticTermRecord,
  SemanticTermWithAliases,
} from "../core/semantic-grounding/types.js";

export interface SemanticGroundingStore {
  upsertTerm(record: SemanticTermRecord): void;
  deleteTermsForDoc(docId: string): void;
  deleteTermsNotInDocIds(docIds: readonly string[]): void;
  upsertAlias(record: SemanticAliasRecord): void;
  upsertRelation(record: SemanticRelationRecord): void;
  listTermsForResolution(query: string, limit?: number): SemanticTermWithAliases[];
  listTermsByDocIds(docIds: readonly string[]): SemanticTermWithAliases[];
  recordGroundingEvent(input: SemanticGroundingEventInput): string;
  upsertFeedbackProposal(input: FeedbackProposalDraft): FeedbackProposalRecord;
  listOpenFeedbackProposals(): FeedbackProposalRecord[];
  createRuntimeSnapshot(): SemanticGroundingRuntimeSnapshot;
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
        version: record.versionId ?? null,
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
          version: record.versionId ?? null,
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
    const rows = this.db
      .select({ termId: semanticTerms.termId })
      .from(semanticTerms)
      .where(eq(semanticTerms.docId, docId))
      .all();
    this.deleteTermsByIds(rows.map((row) => row.termId));
  }

  deleteTermsNotInDocIds(docIds: readonly string[]): void {
    const keepDocIds = new Set(docIds);
    const rows = this.db
      .select({ termId: semanticTerms.termId, docId: semanticTerms.docId })
      .from(semanticTerms)
      .where(isNotNull(semanticTerms.docId))
      .all();
    const staleTermIds = rows
      .filter((row) => !row.docId || !keepDocIds.has(row.docId))
      .map((row) => row.termId);
    this.deleteTermsByIds(staleTermIds);
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
        target: [semanticAliases.termId, semanticAliases.normalizedAlias, semanticAliases.source],
        set: {
          aliasId: record.aliasId,
          alias: record.alias,
          normalizedAlias: record.normalizedAlias,
          locale: record.locale ?? null,
          source: record.source,
          confidence: record.confidence,
          createdAt: record.createdAt,
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
    this.db
      .insert(semanticGroundingEvents)
      .values({
        eventId,
        query: input.query,
        intent: input.intent,
        candidateJson: [...input.candidates],
        planJson: input.plan as unknown as Record<string, unknown>,
        outcome: input.outcome,
        createdAt: new Date().toISOString(),
      })
      .run();
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
          kind: input.kind,
          normalizedTerm: input.normalizedTerm,
          term: input.term,
          payloadJson: input.payload,
          evidenceJson: input.evidence,
          updatedAt: now,
        },
      })
      .run();

    const row = this.db
      .select()
      .from(semanticFeedbackProposals)
      .where(eq(semanticFeedbackProposals.proposalId, proposalId))
      .get();

    return row
      ? {
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
        }
      : {
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
      .orderBy(asc(semanticFeedbackProposals.proposalId))
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

  createRuntimeSnapshot(): SemanticGroundingRuntimeSnapshot {
    const termIds = this.db
      .select({ termId: semanticTerms.termId })
      .from(semanticTerms)
      .orderBy(asc(semanticTerms.termId))
      .all()
      .map((row) => row.termId);

    return {
      source: "definition-service.semantic-grounding",
      storeKind: "sqlite",
      capturedAt: new Date().toISOString(),
      terms: this.listTermsByIds(termIds),
      feedbackProposals: this.listOpenFeedbackProposals(),
    };
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
      ...(term.version ? { versionId: term.version } : {}),
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

  private deleteTermsByIds(termIds: readonly string[]): void {
    if (termIds.length === 0) return;
    this.db.delete(semanticAliases).where(inArray(semanticAliases.termId, termIds)).run();
    this.db
      .delete(semanticRelations)
      .where(or(inArray(semanticRelations.sourceTermId, termIds), inArray(semanticRelations.targetTermId, termIds)))
      .run();
    this.db.delete(semanticTerms).where(inArray(semanticTerms.termId, termIds)).run();
  }
}
