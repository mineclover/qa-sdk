// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { describe, expect, it } from "vitest";
import type { TransmissionInsert } from "@qa-sdk/core";
import { InMemoryTransmissionStore } from "./transmission.adapter.js";

function getTransmissions(
  store: InMemoryTransmissionStore,
): Map<string, TransmissionInsert> {
  return Reflect.get(store, "transmissions") as Map<string, TransmissionInsert>;
}

describe("InMemoryTransmissionStore", () => {
  it("stores inserted transmissions by transmissionId", async () => {
    const store = new InMemoryTransmissionStore();
    const transmission: TransmissionInsert = {
      transmissionId: "tx_1",
      sentAt: new Date("2026-03-12T00:00:00.000Z"),
      ownerType: "workspace",
      ownerId: "workspace_1",
      serviceName: "mobile-app",
      sdkName: "qa-sdk-js",
      sdkVersion: "0.1.0",
      platform: "ios",
      env: "staging",
      recordCount: 3,
    };

    await store.insert(transmission);

    const stored = getTransmissions(store).get("tx_1");

    expect(stored).toEqual(transmission);
    expect(stored).not.toBe(transmission);
  });

  it("rejects duplicate transmission IDs", async () => {
    const store = new InMemoryTransmissionStore();
    const transmission: TransmissionInsert = {
      transmissionId: "tx_1",
      sentAt: new Date("2026-03-12T00:00:00.000Z"),
      ownerType: "workspace",
      ownerId: "workspace_1",
      serviceName: "mobile-app",
      sdkName: "qa-sdk-js",
      sdkVersion: "0.1.0",
      platform: "ios",
      env: "staging",
      recordCount: 3,
    };

    await store.insert(transmission);

    await expect(store.insert(transmission)).rejects.toThrow(
      "Transmission already exists",
    );
  });
});
