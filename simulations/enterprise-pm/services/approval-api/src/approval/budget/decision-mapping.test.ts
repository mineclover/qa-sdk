import { describe, expect, it } from "vitest";
import {
  toStorageDecision,
  fromStorageDecision,
  type ApiDecision,
  type StorageDecision,
} from "./decision-mapping.js";

describe("decision-mapping", () => {
  it("'approve' → 'approved'", () => {
    expect(toStorageDecision("approve")).toBe("approved");
  });

  it("'reject' → 'rejected'", () => {
    expect(toStorageDecision("reject")).toBe("rejected");
  });

  it("unknown api decision → throw", () => {
    expect(() => toStorageDecision("foo" as ApiDecision)).toThrow(/unknown api decision/);
  });

  it("storage 'approved' → 'approve'", () => {
    expect(fromStorageDecision("approved")).toBe("approve");
  });

  it("storage 'rejected' → 'reject'", () => {
    expect(fromStorageDecision("rejected")).toBe("reject");
  });

  it("storage 'pending' → throw (api 표면에 노출 불가)", () => {
    expect(() => fromStorageDecision("pending" as StorageDecision)).toThrow();
  });
});
