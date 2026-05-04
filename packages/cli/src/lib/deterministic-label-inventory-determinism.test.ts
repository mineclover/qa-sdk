// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from "vitest";

import {
  buildDeterministicLabelInventory,
  type DeterministicLabelInventory,
} from "deterministic-label-registry";
import {
  normalizeDocumentEnvelope,
  type DocumentEnvelope,
  type DocumentEnvelopeInput,
} from "doc-envelope";

/**
 * Stability PRD US-003 — fixture-scale byte-identical re-run.
 *
 * `deterministic-label-projection-determinism.spec.md`의 핵심 주장(같은 입력
 * → byte-identical 출력)을 작은 fixture에서 기계 검증한다. 전체 repo
 * snapshot(US-004/US-005)의 baseline 확인 역할.
 */

describe("deterministic-label-registry — byte-identical fixture rerun", () => {
  it("produces identical JSON output across two consecutive inventory calls", async () => {
    const documents = buildFixtureEnvelopes();
    const options = {
      rootDir: "/fixture-root",
      documents,
      detectCompletedRecords: false,
      computeReadiness: true,
    };

    const first = await buildDeterministicLabelInventory(options);
    const second = await buildDeterministicLabelInventory(options);

    expect(serialize(first)).toBe(serialize(second));
  });

  it("keeps record ordering stable regardless of input envelope order", async () => {
    const documents = buildFixtureEnvelopes();
    const forwardOptions = {
      rootDir: "/fixture-root",
      documents,
      detectCompletedRecords: false,
      computeReadiness: true,
    };
    const reverseOptions = {
      ...forwardOptions,
      documents: [...documents].toReversed(),
    };

    const forward = await buildDeterministicLabelInventory(forwardOptions);
    const reverse = await buildDeterministicLabelInventory(reverseOptions);

    const forwardLabels = forward.records.map((record) => record.label);
    const reverseLabels = reverse.records.map((record) => record.label);
    expect(forwardLabels).toEqual(reverseLabels);
  });

  it("emits no absolute path or timestamp fields in serialized output", async () => {
    const documents = buildFixtureEnvelopes();
    const inventory = await buildDeterministicLabelInventory({
      rootDir: "/fixture-root",
      documents,
      detectCompletedRecords: false,
      computeReadiness: true,
    });

    const serialized = serialize(inventory);

    // Absolute path patterns
    expect(serialized).not.toMatch(/\/Users\//);
    expect(serialized).not.toMatch(/\/home\//);
    expect(serialized).not.toMatch(/C:\\\\/);

    // Wall-clock timestamp patterns (ISO-8601 date-time)
    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

function serialize(inventory: DeterministicLabelInventory): string {
  return JSON.stringify(inventory, null, 2);
}

function buildFixtureEnvelopes(): readonly DocumentEnvelope[] {
  return [
    envelope({
      adapterId: "definition-markdown",
      kind: "spec",
      stableId: "example-spec",
      familyId: "docs/specs/example/example",
      path: "docs/specs/example/example.spec.md",
      metadata: {
        defId: "example-spec",
        title: "Example Spec",
        level: "leaf",
        scope: "flow",
        aspect: "process_flow",
        depth: "specification",
        lifecycle: "draft",
        tags: ["structural"],
      },
    }),
    envelope({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/example-prd",
      familyId: "tasks/example-prd",
      path: "tasks/example-prd.md",
      metadata: {
        title: "Example PRD",
      },
    }),
    envelope({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/example-prd",
      familyId: "tasks/example-prd",
      path: "tasks/example-prd.json",
      metadata: {
        name: "Example PRD",
        storyCount: 2,
        passedStoryCount: 1,
      },
      tasks: [
        {
          id: "US-001",
          title: "First story",
          metadata: { passes: true },
        },
        {
          id: "US-002",
          title: "Second story",
          metadata: { passes: false },
        },
      ],
    }),
  ];
}

function envelope(input: Omit<DocumentEnvelopeInput, "rawSource">): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    ...input,
    rawSource: {
      path: input.path,
    },
  });
}
