// @def.doc definition-service
// @def.boundary definition-service-system

import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { createLogger } from "../../lib/logger.js";
import { DocsService } from "../docs/docs.service.js";
import { SearchService } from "../search/search.service.js";
import { syncDocsToDb, type SyncResult } from "../../sync/scanner.js";
import { syncDbToFiles, type ReverseSyncResult } from "../../sync/reverse-sync.js";
import { env } from "../../config/env.js";

const logger = createLogger("definition-service");

@Injectable()
export class SyncService implements OnModuleInit {
  private lastResult: (SyncResult & { timestamp: string }) | null = null;
  private lastReverseResult: (ReverseSyncResult & { timestamp: string }) | null = null;

  constructor(
    @Inject(DocsService) private readonly docs: DocsService,
    @Inject(SearchService) private readonly search: SearchService,
  ) {}

  async onModuleInit() {
    if (!env.SYNC_ON_START) return;
    try {
      const result = await this.run();
      logger.info({
        created: result.created,
        synced: result.synced,
      }, "시작 시 동기화 완료");
    } catch (err) {
      logger.warn({ err }, "시작 시 동기화 실패 — 서비스는 정상 기동");
    }
  }

  /**
   * @def.doc definition-service-sync
   * @facet.intent transform
   * @facet.hierarchy core
   */
  async run(): Promise<SyncResult> {
    logger.info("동기화 프로세스 시작"); // @facet.hierarchy auxiliary
    const result = await syncDocsToDb(env.DOCS_DIR, env.ROOT_DIR, this.docs.getStore());
    this.lastResult = { ...result, timestamp: new Date().toISOString() };

    // sync 완료 후 검색 인덱스 재구축
    this.rebuildSearchIndex(); // @facet.hierarchy core

    logger.info({ synced: result.synced }, "동기화 완료"); // @facet.hierarchy auxiliary
    return result;
  }

  /** 전체 문서 검색 인덱스 재구축 */
  private rebuildSearchIndex() {
    const allDocs = this.docs.list({ limit: 10000 });
    let indexed = 0;
    for (const doc of allDocs) {
      this.search.index(doc.docId, doc.purpose, doc.intent, doc.context, doc.caveat);
      indexed++;
    }
    logger.info({ indexed }, "검색 인덱스 재구축 완료");
  }

  async runReverse(): Promise<ReverseSyncResult> {
    const result = await syncDbToFiles(env.ROOT_DIR, this.docs.getStore());
    this.lastReverseResult = { ...result, timestamp: new Date().toISOString() };
    return result;
  }

  getLastResult() {
    return this.lastResult;
  }

  getLastReverseResult() {
    return this.lastReverseResult;
  }
}
