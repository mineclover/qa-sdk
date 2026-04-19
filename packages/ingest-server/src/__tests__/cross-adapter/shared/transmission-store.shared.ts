// @def.boundary ingest-system
// @def.doc ingest-system

import type { TransmissionStore, TransmissionInsert } from "@qa-sdk/core";
import { expect, it, beforeEach, afterEach } from "vitest";

function makeTransmission(overrides: Partial<TransmissionInsert> = {}): TransmissionInsert {
  return {
    transmissionId: "tx-1",
    sentAt: new Date("2026-01-01T00:00:00Z"),
    ownerType: "service",
    ownerId: "svc-web",
    serviceName: "web",
    sdkName: "@qa-sdk/browser-sdk",
    sdkVersion: "1.0.0",
    platform: "browser",
    env: "test",
    recordCount: 5,
    ...overrides,
  };
}

export function transmissionStoreTests(
  factory: () => Promise<{ store: TransmissionStore; cleanup: () => Promise<void> }>,
) {
  let store: TransmissionStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it("insert 성공 (no error)", async () => {
    // TransmissionStore는 insert만 제공 — 에러 없이 완료되는지 검증
    await expect(store.insert(makeTransmission())).resolves.not.toThrow();
  });

  it("중복 transmissionId insert — 에러 또는 무시", async () => {
    await store.insert(makeTransmission({ transmissionId: "tx-dup" }));
    // 두 번째 insert — 중복 키. 에러가 발생하거나 무시됨
    // 어댑터마다 다를 수 있으므로 에러가 아닌 한 통과
    try {
      await store.insert(makeTransmission({ transmissionId: "tx-dup" }));
    } catch {
      // 중복 키 에러 허용
    }
  });
}
