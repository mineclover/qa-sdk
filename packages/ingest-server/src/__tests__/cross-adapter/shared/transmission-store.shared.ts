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
}
