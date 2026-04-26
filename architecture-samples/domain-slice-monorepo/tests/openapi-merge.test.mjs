import { describe, expect, it } from "vitest";

import { mergeSpecs } from "../scripts/merge-openapi.mjs";

describe("OpenAPI merge", () => {
  it("rejects path collisions between base and profile specs", () => {
    expect(() => mergeSpecs(
      { paths: { "/health": { get: {} } } },
      { paths: { "/health": { get: {} } } },
      [],
    )).toThrow("duplicate OpenAPI path: /health");
  });

  it("rejects component collisions between base and profile specs", () => {
    expect(() => mergeSpecs(
      { components: { schemas: { ErrorResponse: {} } } },
      { components: { schemas: { ErrorResponse: {} } } },
      [],
    )).toThrow("duplicate OpenAPI component schemas: ErrorResponse");
  });
});
