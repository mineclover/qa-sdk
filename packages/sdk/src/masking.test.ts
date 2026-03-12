import { describe, expect, it } from "vitest";
import { applyMasking } from "./masking.js";

describe("applyMasking", () => {
  it("keeps raw fields unchanged", () => {
    expect(
      applyMasking(
        { token: "visible", untouched: "keep" },
        [{ field: "token", mode: "raw" }],
      ),
    ).toEqual({
      masked: { token: "visible", untouched: "keep" },
      maskedFields: ["token"],
    });
  });

  it("replaces masked fields with presence markers", () => {
    const present = applyMasking(
      { email: "dev@example.com" },
      [{ field: "email", mode: "mask" }],
    );
    const absent = applyMasking({ email: null }, [{ field: "email", mode: "mask" }]);

    expect(present.masked).toEqual({
      email: { _masked: true, _present: true },
    });
    expect(absent.masked).toEqual({
      email: { _masked: true, _present: false },
    });
    expect(present.maskedFields).toEqual(["email"]);
    expect(absent.maskedFields).toEqual(["email"]);
  });

  it("drops fields configured with drop mode", () => {
    expect(
      applyMasking(
        { password: "secret", untouched: "keep" },
        [{ field: "password", mode: "drop" }],
      ),
    ).toEqual({
      masked: { untouched: "keep" },
      maskedFields: ["password"],
    });
  });

  it("hashes fields configured with hash mode", () => {
    expect(
      applyMasking(
        { apiKey: "secret" },
        [{ field: "apiKey", mode: "hash" }],
      ),
    ).toEqual({
      masked: { apiKey: "h_c9fb4eb0" },
      maskedFields: ["apiKey"],
    });
  });
});
