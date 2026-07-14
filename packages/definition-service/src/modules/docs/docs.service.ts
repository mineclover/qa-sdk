// @def.doc definition-service
// @def.boundary definition-service-system

import { Injectable, Inject, Optional } from '@nestjs/common';
import { isAbsolute, relative } from 'node:path';
import { DRIZZLE_DB, type DefinitionServiceDatabase } from '../../database.module.js';
import { SqlDocStore } from '../../stores/doc-store.js';
import type { DocRecord, DocHistoryRecord } from '../../core/types.js';
import type {
  DocStore,
  DocMetadataUpdate,
  DocListFilter,
  DocListResult,
} from '../../core/interfaces.js';
import type {
  DefBoundaryResolutionCandidate,
  DefCodeReference,
  DefFeedbackRequestSummary,
  DefFileBoundaryResolution,
  DefSyntheticIncomingLink,
} from 'definition-catalog';
import { formatCodeReferenceTarget, parseCodeReferenceTarget } from 'definition-catalog';
import { mergeSemanticDocumentResults } from '../../core/semantic-grounding/planner.js';
import { SearchService } from '../search/search.service.js';
import { SemanticGroundingService } from '../semantic-grounding/semantic-grounding.service.js';
import {
  getFeedbackRequestSummariesForDoc,
  getSyntheticIncomingLinksForDoc,
} from './review-feedback.js';

@Injectable()
export class DocsService {
  private readonly store: SqlDocStore;

  constructor(
    @Inject(DRIZZLE_DB) db: DefinitionServiceDatabase,
    @Optional() @Inject(SearchService) private readonly search?: SearchService,
    @Optional()
    @Inject(SemanticGroundingService)
    private readonly semantic?: SemanticGroundingService,
  ) {
    this.store = new SqlDocStore(db);
  }

  /** DocStore 인스턴스 — sync 모듈에서도 사용 */
  getStore(): DocStore {
    return this.store;
  }

  list(filter?: DocListFilter): DocRecord[] {
    // 전문 검색은 SearchService로 위임
    if (filter?.q && this.search) {
      return this.searchWithSemanticGrounding(filter.q, filter?.limit ?? 50, filter?.offset ?? 0)
        .docs;
    }
    return this.store.list(filter);
  }

  /** 페이지네이션 포함 목록 조회 */
  listPaginated(filter?: DocListFilter): DocListResult {
    const limit = filter?.limit ?? 500;
    const offset = filter?.offset ?? 0;

    if (filter?.q && this.search) {
      const result = this.searchWithSemanticGrounding(filter.q, limit, offset);
      return { docs: result.docs, total: result.total, offset, limit };
    }

    const docs = this.store.list(filter);
    const total = this.store.count(filter);
    return { docs, total, offset, limit };
  }

  private searchWithSemanticGrounding(
    query: string,
    limit: number,
    offset: number,
  ): { docs: DocRecord[]; total: number } {
    if (!this.semantic) {
      return this.searchLegacy(query, limit, offset);
    }

    const plan = this.semantic.planDocumentSearch(query);
    const hasSemanticCandidates = plan.candidateDocIds.length > 0;
    if (!hasSemanticCandidates) {
      const legacy = this.searchLegacy(query, limit, offset);
      this.semantic.recordDocumentSearch({
        query,
        plan,
        docs: legacy.docs,
        legacyCount: legacy.total,
        semanticCandidateCount: plan.candidateDocIds.length,
        semanticHitCount: 0,
        semanticOnlyCount: 0,
        legacyOnlyCount: legacy.total,
      });
      return legacy;
    }

    const legacy = this.searchLegacy(query, Math.max(limit + offset, 50), 0);
    const legacyDocs = legacy.docs;
    const legacyCount = legacy.total;
    const semanticDocs = hasSemanticCandidates ? this.store.getMany(plan.candidateDocIds) : [];
    const semanticDocIdSet = new Set(semanticDocs.map((doc) => doc.docId));
    const realizedCandidateDocIds = plan.candidateDocIds.filter((docId) =>
      semanticDocIdSet.has(docId),
    );
    const legacyCandidateDocIds =
      realizedCandidateDocIds.length > 0
        ? this.matchLegacyDocIds(query, realizedCandidateDocIds, legacyDocs, semanticDocIdSet)
        : new Set<string>();
    const semanticOnlyDocs = semanticDocs.filter((doc) => !legacyCandidateDocIds.has(doc.docId));
    const legacyOnlyCount = Math.max(legacyCount - legacyCandidateDocIds.size, 0);
    const merged = hasSemanticCandidates
      ? mergeSemanticDocumentResults({
          semanticDocs,
          legacyDocs,
          candidateDocIds: realizedCandidateDocIds,
          limit: semanticDocs.length + legacyDocs.length,
          offset: 0,
        })
      : legacyDocs;
    this.semantic.recordDocumentSearch({
      query,
      plan,
      docs: merged,
      legacyCount,
      semanticCandidateCount: plan.candidateDocIds.length,
      semanticHitCount: semanticDocs.length,
      semanticOnlyCount: semanticOnlyDocs.length,
      legacyOnlyCount,
    });

    return {
      docs: merged.slice(offset, offset + limit),
      total: legacyCount + semanticOnlyDocs.length,
    };
  }

  private searchLegacy(
    query: string,
    limit: number,
    offset: number,
  ): { docs: DocRecord[]; total: number } {
    const docs = this.search?.search(query, limit, offset) ?? [];
    return { docs, total: this.search?.searchCount(query) ?? docs.length };
  }

  private matchLegacyDocIds(
    query: string,
    candidateDocIds: readonly string[],
    legacyDocs: readonly DocRecord[],
    semanticDocIdSet: ReadonlySet<string>,
  ): Set<string> {
    return (
      this.search?.matchDocIds?.(query, candidateDocIds) ??
      new Set(legacyDocs.filter((doc) => semanticDocIdSet.has(doc.docId)).map((doc) => doc.docId))
    );
  }

  get(docId: string): DocRecord | null {
    return this.store.get(docId);
  }

  getByAddress(address: string): DocRecord | null {
    return this.store.getByAddress(address);
  }

  getBody(docId: string) {
    return this.store.getBody(docId);
  }

  listCodeReferences() {
    return this.store.listCodeReferences();
  }

  private normalizeCodeReferenceTarget(filePath: string): { codePath: string; symbol?: string } {
    const parsed = parseCodeReferenceTarget(filePath.replaceAll('\\', '/'));
    const rawPath = parsed?.codePath ?? filePath;
    const symbol = parsed?.symbol;
    if (isAbsolute(rawPath)) {
      const relPath = relative(process.cwd(), rawPath).replaceAll('\\', '/');
      if (relPath !== '' && !relPath.startsWith('../')) {
        return { codePath: relPath, symbol };
      }
    }
    return { codePath: rawPath.replaceAll('\\', '/'), symbol };
  }

  private resolveBoundaryAnchor(doc: DocRecord): DocRecord {
    if (doc.level === 'group' || doc.level === 'module') return doc;

    let current = doc;
    const visited = new Set<string>([doc.docId]);
    while (true) {
      const parent = this.getParent(current.docId);
      if (!parent || visited.has(parent.docId)) return current;
      if (parent.level === 'group' || parent.level === 'module') return parent;
      visited.add(parent.docId);
      current = parent;
    }
  }

  resolveByFile(filePath: string): DefFileBoundaryResolution {
    const requested = this.normalizeCodeReferenceTarget(filePath);
    const references = this.store.getCodeReferencesByPath(requested.codePath).map((ref) =>
      Object.assign(
        {
          codePath: ref.codePath,
          docId: ref.docId,
          relationType: ref.relationType,
          sourceKind: ref.sourceKind,
        },
        ref.symbol ? { symbol: ref.symbol } : {},
        ref.line !== undefined ? { line: ref.line } : {},
      ),
    ) as DefCodeReference[];

    const scopedReferences = requested.symbol
      ? references.filter((ref) => (ref.symbol ?? '') === requested.symbol || !ref.symbol)
      : references;

    if (scopedReferences.length === 0) {
      return {
        kind: 'none',
        codePath: formatCodeReferenceTarget(requested),
        references: scopedReferences,
      };
    }

    const docs = [...new Set(scopedReferences.map((ref) => ref.docId))]
      .map((docId) => this.get(docId))
      .filter((doc): doc is DocRecord => Boolean(doc));
    if (docs.length === 0) {
      return {
        kind: 'none',
        codePath: formatCodeReferenceTarget(requested),
        references: scopedReferences,
      };
    }

    const boundaryDocIds = [
      ...new Set(
        scopedReferences.filter((ref) => ref.relationType === 'boundary').map((ref) => ref.docId),
      ),
    ];
    if (boundaryDocIds.length > 1) {
      const candidates = docs
        .filter((doc) => boundaryDocIds.includes(doc.docId))
        .map((anchor) => ({
          anchor,
          supportingDocs: docs.filter((doc) => doc.docId === anchor.docId),
          references: scopedReferences,
        })) as DefBoundaryResolutionCandidate[];
      return {
        kind: 'ambiguous',
        codePath: formatCodeReferenceTarget(requested),
        candidates,
        references: scopedReferences,
      };
    }

    const byAnchor = new Map<string, DefBoundaryResolutionCandidate>();
    for (const doc of docs) {
      const anchor =
        boundaryDocIds.length === 1
          ? (docs.find((item) => item.docId === boundaryDocIds[0]) ?? doc)
          : this.resolveBoundaryAnchor(doc);
      const existing = byAnchor.get(anchor.docId);
      if (existing) existing.supportingDocs.push(doc);
      else
        byAnchor.set(anchor.docId, { anchor, supportingDocs: [doc], references: scopedReferences });
    }

    const candidates = [...byAnchor.values()].map((candidate) => ({
      anchor: candidate.anchor,
      supportingDocs: candidate.supportingDocs.toSorted((a, b) => a.docId.localeCompare(b.docId)),
      references: scopedReferences,
    }));

    if (candidates.length === 1) {
      return {
        kind: 'unique',
        codePath: formatCodeReferenceTarget(requested),
        anchor: candidates[0]!.anchor,
        supportingDocs: candidates[0]!.supportingDocs,
        references: scopedReferences,
      };
    }

    return {
      kind: 'ambiguous',
      codePath: formatCodeReferenceTarget(requested),
      candidates,
      references: scopedReferences,
    };
  }

  getHistory(docId: string, limit?: number): DocHistoryRecord[] {
    return this.store.getHistory(docId, limit);
  }

  getVersion(docId: string, version: number): DocHistoryRecord | null {
    return this.store.getVersion(docId, version);
  }

  updateMetadata(docId: string, patch: DocMetadataUpdate) {
    const result = this.store.updateMetadata(docId, patch);
    // 메타데이터 변경 후 검색 인덱스 갱신
    if (result && result.action === 'updated') {
      const doc = this.store.get(docId);
      if (doc) this.search?.index(docId, doc.purpose, doc.intent, doc.context, doc.caveat);
      if (doc) this.semantic?.materializeDocuments([doc]);
    }
    return result;
  }

  // ── 계층 + 링크 쿼리 ──────────────────────────────────

  getChildren(docId: string): DocRecord[] {
    return this.store.getChildren(docId);
  }

  getParent(docId: string): DocRecord | null {
    return this.store.getParent(docId);
  }

  getIncomingLinks(docId: string) {
    return this.store.getIncomingLinks(docId);
  }

  getSyntheticIncomingLinks(docId: string): DefSyntheticIncomingLink[] {
    return getSyntheticIncomingLinksForDoc(docId);
  }

  getOutgoingLinks(docId: string) {
    return this.store.getOutgoingLinks(docId);
  }

  getFeedbackRequests(docId: string, limit = 10): DefFeedbackRequestSummary[] {
    return getFeedbackRequestSummariesForDoc(docId, limit);
  }

  getFeedbackTrace(docIds: readonly string[], limit = 20): DefFeedbackRequestSummary[] {
    const seen = new Set<string>();
    const trace: DefFeedbackRequestSummary[] = [];

    for (const docId of docIds) {
      const requests = this.getFeedbackRequests(docId, limit);
      for (const request of requests) {
        if (seen.has(request.id)) continue;
        seen.add(request.id);
        trace.push(request);
      }
    }

    return trace
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  getBoundary(docId: string, level: 'purpose' | 'overview' = 'overview') {
    const doc = this.store.get(docId);
    if (!doc) return null;

    const scopeOrder = ['constraint', 'state', 'data', 'feature', 'flow', 'interface', 'ui'];
    const linkOrder = ['constrains', 'depends_on', 'refines'];
    const summary = (purpose?: string, overview?: string) =>
      (level === 'purpose' ? purpose : (purpose ?? overview))?.split('\n')[0]?.trim() ||
      '(요약 없음)';
    const scopeIndex = (scope: string) => {
      const idx = scopeOrder.indexOf(scope);
      return idx === -1 ? 999 : idx;
    };
    const linkIndex = (type: string) => {
      const idx = linkOrder.indexOf(type);
      return idx === -1 ? 999 : idx;
    };

    const children = this.getChildren(docId)
      .toSorted(
        (left, right) =>
          scopeIndex(left.scope) - scopeIndex(right.scope) || left.docId.localeCompare(right.docId),
      )
      .map((child) => ({
        docId: child.docId,
        title: child.title ?? child.docId,
        scope: child.scope,
        aspect: child.aspect,
        depth: child.depth,
        summary: summary(child.purpose, child.context),
      }));

    const outgoing = this.getOutgoingLinks(docId)
      .filter(
        (link) =>
          link.type === 'depends_on' || link.type === 'constrains' || link.type === 'refines',
      )
      .toSorted(
        (left, right) =>
          linkIndex(left.type) - linkIndex(right.type) || left.target.localeCompare(right.target),
      )
      .map((link) => {
        const target = this.store.get(link.target);
        return {
          type: link.type,
          target: link.target,
          summary: summary(target?.purpose, target?.context),
        };
      });

    const incoming = this.getIncomingLinks(docId)
      .filter(
        (link) =>
          link.type === 'depends_on' || link.type === 'constrains' || link.type === 'refines',
      )
      .toSorted(
        (left, right) =>
          linkIndex(left.type) - linkIndex(right.type) || left.source.localeCompare(right.source),
      )
      .map((link) => {
        const source = this.store.get(link.source);
        return {
          type: link.type,
          source: link.source,
          summary: summary(source?.purpose, source?.context),
        };
      });

    return {
      boundary: {
        docId: doc.docId,
        title: doc.title ?? doc.docId,
        scope: doc.scope,
        aspect: doc.aspect,
        depth: doc.depth,
        lifecycle: doc.lifecycle,
        ...(doc.layer ? { layer: doc.layer } : {}),
        ...(doc.svc ? { svc: doc.svc } : {}),
        ...(doc.purpose ? { purpose: doc.purpose } : {}),
        ...(level === 'overview' && doc.context ? { overview: doc.context } : {}),
      },
      members: children,
      couplings: { outgoing, incoming },
    };
  }

  // ── 단일 link/tag 원자적 mutation ─────────────────────

  addLink(docId: string, target: string, type: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    const existing = doc.links.find((l) => l.target === target && l.type === type);
    if (existing) return { action: 'unchanged' as const };
    const newLinks = [...doc.links, { target, type }];
    return this.store.updateMetadata(docId, { links: newLinks });
  }

  removeLink(docId: string, target: string, type: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    const newLinks = doc.links.filter((l) => !(l.target === target && l.type === type));
    if (newLinks.length === doc.links.length) return { action: 'unchanged' as const };
    return this.store.updateMetadata(docId, { links: newLinks });
  }

  addTag(docId: string, tag: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    if (doc.tags.includes(tag)) return { action: 'unchanged' as const };
    return this.store.updateMetadata(docId, { tags: [...doc.tags, tag] });
  }

  removeTag(docId: string, tag: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    const newTags = doc.tags.filter((t) => t !== tag);
    if (newTags.length === doc.tags.length) return { action: 'unchanged' as const };
    return this.store.updateMetadata(docId, { tags: newTags });
  }
}
