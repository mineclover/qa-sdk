import { Injectable, Inject } from "@nestjs/common";
import type Database from "better-sqlite3";
import { DATABASE } from "../../database.module.js";
import { SqlDocStore } from "../../stores/doc-store.js";
import type { DocRecord, DocHistoryRecord } from "../../core/types.js";
import type { DocStore } from "../../core/interfaces.js";

@Injectable()
export class DocsService {
  private readonly store: DocStore;

  constructor(@Inject(DATABASE) db: Database.Database) {
    this.store = new SqlDocStore(db);
  }

  /** DocStore 인스턴스 — sync 모듈에서도 사용 */
  getStore(): DocStore {
    return this.store;
  }

  list(filter?: { scope?: string; aspect?: string; lifecycle?: string }): DocRecord[] {
    return this.store.list(filter);
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
}
