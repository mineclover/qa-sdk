import { describe, expect, it } from "vitest";
import { newEventId, newServiceId } from "../../lib/id.js";

const ULID_LENGTH = 26;

describe("ID generators", () => {
  it("creates service IDs with the expected prefix and ULID length", () => {
    const serviceId = newServiceId();

    expect(serviceId.startsWith("svc_")).toBe(true);
    expect(serviceId.slice(4)).toHaveLength(ULID_LENGTH);
  });

  it("creates event IDs with the expected prefix and ULID length", () => {
    const eventId = newEventId();

    expect(eventId.startsWith("evt_")).toBe(true);
    expect(eventId.slice(4)).toHaveLength(ULID_LENGTH);
  });

  it("returns unique values for consecutive calls", () => {
    const firstServiceId = newServiceId();
    const secondServiceId = newServiceId();
    const firstEventId = newEventId();
    const secondEventId = newEventId();

    expect(firstServiceId).not.toBe(secondServiceId);
    expect(firstEventId).not.toBe(secondEventId);
  });
});
