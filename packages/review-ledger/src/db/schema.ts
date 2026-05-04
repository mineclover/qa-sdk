// @def.boundary system-root
/**
 * Review Ledger — Drizzle ORM 스키마.
 *
 * 1개 테이블: review_entries (어펜드 전용 원장)
 * node:sqlite 기반. ~/.qa-sdk/review-ledger.sqlite 에 저장.
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const reviewEntries = sqliteTable(
  "review_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** 레포 루트 기준 상대경로 */
    filePath: text("file_path").notNull(),
    /** 리뷰 완료 시점의 커밋 SHA (full 40자) */
    reviewedCommit: text("reviewed_commit").notNull(),
    /** 리뷰 완료 시각 ISO-8601 */
    reviewedAt: text("reviewed_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    /** 리뷰어 이름 */
    reviewer: text("reviewer").notNull(),
    /** 리뷰에 사용된 AI 모델 (claude-opus-4-6 등) */
    aiModel: text("ai_model"),
    /** 서비스 스코프 (filePath에서 파생) */
    serviceScope: text("service_scope").notNull(),
    /** 리뷰 메모 (선택) */
    notes: text("notes"),
  },
  (table) => [
    index("idx_re_file").on(table.filePath),
    index("idx_re_scope").on(table.serviceScope),
    index("idx_re_reviewer").on(table.reviewer),
    index("idx_re_at").on(table.reviewedAt),
    uniqueIndex("idx_re_file_commit").on(table.filePath, table.reviewedCommit),
  ],
);

export type ReviewEntryRow = typeof reviewEntries.$inferSelect;

export const feedbackRequests = sqliteTable(
  "feedback_requests",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    requestedBy: text("requested_by").notNull(),
    purpose: text("purpose").notNull(),
    targetModel: text("target_model"),
    serviceScope: text("service_scope"),
    status: text("status").notNull().default("open"),
    notes: text("notes"),
    prompt: text("prompt").notNull(),
    evidenceBundle: text("evidence_bundle").notNull(),
  },
  (table) => [
    index("idx_fr_created").on(table.createdAt),
    index("idx_fr_scope").on(table.serviceScope),
    index("idx_fr_status").on(table.status),
    index("idx_fr_requested_by").on(table.requestedBy),
  ],
);

export type FeedbackRequestRow = typeof feedbackRequests.$inferSelect;
