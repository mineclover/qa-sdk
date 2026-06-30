import { describe, expect, it } from "vitest";
import type { DefinitionEntry } from "definition-catalog";
import { buildDocRecord } from "./sync-engine.js";

function definitionEntry(overrides: Partial<DefinitionEntry> = {}): DefinitionEntry {
  return {
    id: "definition-service-system",
    title: "Definition Service",
    scope: "data" as DefinitionEntry["scope"],
    aspect: "domain_data" as DefinitionEntry["aspect"],
    depth: "overview" as DefinitionEntry["depth"],
    lifecycle: "approved" as DefinitionEntry["lifecycle"],
    tier: "system" as DefinitionEntry["tier"],
    tags: [],
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildDocRecord", () => {
  it("preserves tier metadata from the definition entry", () => {
    const record = buildDocRecord(
      definitionEntry(),
      "## purpose\n\nsync docs",
      [],
      "docs/definition-service-system.md",
    );

    expect(record.tier).toBe("system");
  });

  it("rejects entries without required coordinate metadata", () => {
    expect(() =>
      buildDocRecord(
        definitionEntry({ scope: undefined }),
        "",
        [],
        "docs/missing-scope.md",
      ),
    ).toThrow('definition "definition-service-system" is missing required def.scope');
  });
});
