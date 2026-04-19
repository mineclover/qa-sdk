// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordInsert, RecordStore } from "@qa-sdk/core";

/**
 * RecordStore 인터페이스 계약 테스트.
 * 메모리/Drizzle 등 모든 어댑터가 동일한 계약을 만족하는지 검증한다.
 *
 * 사용법:
 *   import { runRecordStoreContract } from "../record.adapter.contract.js";
 *   runRecordStoreContract(() => new InMemoryRecordStore());
 */

function buildRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
  return {
    logId: "log_1",
    traceId: "trace_1",
    spanId: "span_1",
    timestamp: new Date("2026-03-12T00:00:03.000Z"),
    recordKind: "log",
    eventKey: "user_signed_in",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: { ok: true },
    qaSessionId: "session_1",
    ...overrides,
  };
}

export function runRecordStoreContract(
  createStore: () => RecordStore | Promise<RecordStore>,
): void {
  describe("RecordStore 계약", () => {
    let store: RecordStore;

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-12T01:00:00.000Z"));
      store = await createStore();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("레코드를 저장하고 traceId, sessionId, eventKey로 조회한다", async () => {
      const early = buildRecord({
        logId: "log_early",
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
        eventKey: "user_signed_in",
      });
      const late = buildRecord({
        logId: "log_late",
        timestamp: new Date("2026-03-12T00:00:03.000Z"),
        eventKey: "checkout_completed",
      });
      const otherTrace = buildRecord({
        logId: "log_other",
        traceId: "trace_2",
        qaSessionId: "session_2",
        timestamp: new Date("2026-03-12T00:00:02.000Z"),
      });

      await store.insertBatch([late, early, otherTrace]);

      const storedAt = new Date("2026-03-12T01:00:00.000Z");

      await expect(store.findByTraceId("trace_1")).resolves.toEqual([
        { ...early, createdAt: storedAt },
        { ...late, createdAt: storedAt },
      ]);

      await expect(store.findBySessionId("session_1")).resolves.toEqual([
        { ...early, createdAt: storedAt },
        { ...late, createdAt: storedAt },
      ]);

      await expect(
        store.findByTraceAndEventKey("trace_1", "user_signed_in"),
      ).resolves.toEqual([{ ...early, createdAt: storedAt }]);
    });

    it("존재하지 않는 traceId/sessionId 조회 시 빈 배열을 반환한다", async () => {
      await expect(store.findByTraceId("no_such_trace")).resolves.toEqual([]);
      await expect(store.findBySessionId("no_such_session")).resolves.toEqual([]);
      await expect(
        store.findByTraceAndEventKey("no_such_trace", "click"),
      ).resolves.toEqual([]);
    });

    it("중복 logId가 포함된 배치 삽입 시 에러를 던지고 저장소를 변경하지 않는다", async () => {
      await store.insertBatch([buildRecord({ logId: "log_existing" })]);

      await expect(
        store.insertBatch([
          buildRecord({ logId: "log_existing" }),
          buildRecord({ logId: "log_new", traceId: "trace_2" }),
        ]),
      ).rejects.toThrow();

      // 롤백 검증: log_new가 저장되지 않아야 함
      await expect(store.findByTraceId("trace_2")).resolves.toEqual([]);
    });

    it("timestamp + logId 커서 기반 페이지네이션이 동작한다", async () => {
      const a = buildRecord({
        logId: "log_a",
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
      });
      const b = buildRecord({
        logId: "log_b",
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
        eventKey: "checkout_started",
      });
      const c = buildRecord({
        logId: "log_c",
        timestamp: new Date("2026-03-12T00:00:02.000Z"),
        eventKey: "checkout_completed",
      });

      await store.insertBatch([c, b, a]);

      const page1 = await store.findByTraceIdPaginated("trace_1", { limit: 2 });

      expect(page1.items.map((r) => r.logId)).toEqual(["log_a", "log_b"]);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toEqual({
        timestamp: new Date("2026-03-12T00:00:01.000Z"),
        logId: "log_b",
      });

      const page2 = await store.findByTraceIdPaginated("trace_1", {
        limit: 2,
        cursor: page1.nextCursor ?? undefined,
      });

      expect(page2.items.map((r) => r.logId)).toEqual(["log_c"]);
      expect(page2.hasMore).toBe(false);
      expect(page2.nextCursor).toBeNull();
    });
  });
}
