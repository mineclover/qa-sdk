import { describe, expect, it } from "vitest";

import { validateOntologyPackRuntime } from "./runtime-validation.js";

describe("ontology pack runtime validation", () => {
  it("maps runtime pack validation issues into CLI issue shape and summary", () => {
    const runtime = validateOntologyPackRuntime({
      packId: " ",
      schema: {
        axes: [],
        taxonomies: [],
        relationCategories: [],
      },
    });

    expect(runtime.summary).toEqual({
      valid: false,
      issueCount: runtime.issues.length,
    });
    expect(runtime.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          source: "pack",
          path: "packId",
          code: "pack-id-empty",
          message: expect.any(String),
        }),
      ]),
    );
  });
});
