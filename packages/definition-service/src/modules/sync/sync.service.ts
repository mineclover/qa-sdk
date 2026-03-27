import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { DocsService } from "../docs/docs.service.js";
import { syncDocsToDb, type SyncResult } from "../../sync/scanner.js";
import { syncDbToFiles, type ReverseSyncResult } from "../../sync/reverse-sync.js";
import { env } from "../../config/env.js";

@Injectable()
export class SyncService implements OnModuleInit {
  private lastResult: (SyncResult & { timestamp: string }) | null = null;
  private lastReverseResult: (ReverseSyncResult & { timestamp: string }) | null = null;

  constructor(@Inject(DocsService) private readonly docs: DocsService) {}

  /** 서비스 시작 시 자동 sync (SYNC_ON_START=true) */
  async onModuleInit() {
    if (!env.SYNC_ON_START) return;
    try {
      await this.run();
      console.log(`[sync] 시작 시 동기화 완료: created=${this.lastResult!.created}, synced=${this.lastResult!.synced}`);
    } catch (err) {
      console.warn("[sync] 시작 시 동기화 실패 — 서비스는 정상 기동", err);
    }
  }

  /** file → DB 동기화 */
  async run(): Promise<SyncResult> {
    const result = await syncDocsToDb(env.DOCS_DIR, env.ROOT_DIR, this.docs.getStore());
    this.lastResult = { ...result, timestamp: new Date().toISOString() };
    return result;
  }

  /** DB → file 역동기화 (메타데이터를 frontmatter에 기록) */
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
