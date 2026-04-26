import { describe, expect, it } from "vitest";

import { buildCacheKey, validateCacheKeyDefinitions, type CacheKeyDefinition } from "./cache-key-dsl.js";

describe("cache key DSL", () => {
  const definition: CacheKeyDefinition = {
    id: "assignment-read-model",
    domain: "assignment",
    purpose: "read_model",
    version: "v1",
    prefix: "assignment-read-model",
    ttl: "medium",
    openmetadataEntity: "reporting.assignment_read_model",
    segments: [{ name: "assignmentId" }],
  };

  it("builds prefix:version:id keys from a definition", () => {
    expect(buildCacheKey({ definition, values: { assignmentId: "asg_123" } })).toBe(
      "assignment-read-model:v1:asg_123",
    );
  });

  it("requires PII segments to be hashed and read-model keys to map to metadata", () => {
    const issues = validateCacheKeyDefinitions([
      {
        ...definition,
        id: "assignment-manager-lookup",
        prefix: "assignment-manager-lookup",
        openmetadataEntity: undefined,
        segments: [{ name: "managerId", pii: true, encoding: "raw" }],
      },
    ]);

    expect(issues.map((issue) => issue.message)).toEqual([
      "Read model/projection cache keys must map to an OpenMetadata entity.",
      'PII segment "managerId" must use hash encoding.',
    ]);
  });
});

