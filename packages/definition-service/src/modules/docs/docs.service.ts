import { Injectable, Inject, Optional } from "@nestjs/common";
import { DRIZZLE_DB, type DefinitionServiceDatabase } from "../../database.module.js";
import { SqlDocStore } from "../../stores/doc-store.js";
import type { DocRecord, DocHistoryRecord } from "../../core/types.js";
import type { DocStore, DocMetadataUpdate, DocListFilter, DocListResult } from "../../core/interfaces.js";
import type { DefFeedbackRequestSummary, DefSyntheticIncomingLink } from "definition-catalog";
import { SearchService } from "../search/search.service.js";
import {
  getFeedbackRequestSummariesForDoc,
  getSyntheticIncomingLinksForDoc,
} from "./review-feedback.js";

@Injectable()
export class DocsService {
  private readonly store: SqlDocStore;

  constructor(
    @Inject(DRIZZLE_DB) db: DefinitionServiceDatabase,
    @Optional() @Inject(SearchService) private readonly search?: SearchService,
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
      return this.search.search(filter.q, filter?.limit ?? 50, filter?.offset ?? 0);
    }
    return this.store.list(filter);
  }

  /** 페이지네이션 포함 목록 조회 */
  listPaginated(filter?: DocListFilter): DocListResult {
    const limit = filter?.limit ?? 500;
    const offset = filter?.offset ?? 0;

    if (filter?.q && this.search) {
      const docs = this.search.search(filter.q, limit, offset);
      const total = this.search.searchCount(filter.q);
      return { docs, total, offset, limit };
    }

    const docs = this.store.list(filter);
    const total = this.store.count(filter);
    return { docs, total, offset, limit };
  }

  get(docId: string): DocRecord | null {
    return this.store.get(docId);
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
    if (result && result.action === "updated") {
      const doc = this.store.get(docId);
      if (doc) this.search?.index(docId, doc.purpose, doc.intent, doc.context, doc.caveat);
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

  // ── 단일 link/tag 원자적 mutation ─────────────────────

  addLink(docId: string, target: string, type: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    const existing = doc.links.find(l => l.target === target && l.type === type);
    if (existing) return { action: "unchanged" as const };
    const newLinks = [...doc.links, { target, type }];
    return this.store.updateMetadata(docId, { links: newLinks });
  }

  removeLink(docId: string, target: string, type: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    const newLinks = doc.links.filter(l => !(l.target === target && l.type === type));
    if (newLinks.length === doc.links.length) return { action: "unchanged" as const };
    return this.store.updateMetadata(docId, { links: newLinks });
  }

  addTag(docId: string, tag: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    if (doc.tags.includes(tag)) return { action: "unchanged" as const };
    return this.store.updateMetadata(docId, { tags: [...doc.tags, tag] });
  }

  removeTag(docId: string, tag: string) {
    const doc = this.store.get(docId);
    if (!doc) return null;
    const newTags = doc.tags.filter(t => t !== tag);
    if (newTags.length === doc.tags.length) return { action: "unchanged" as const };
    return this.store.updateMetadata(docId, { tags: newTags });
  }
}
