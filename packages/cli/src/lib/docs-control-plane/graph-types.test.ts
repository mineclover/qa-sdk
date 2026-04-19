// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from "vitest";

import {
  AUTHORED_LINK_AXIS_MAP,
  CANONICAL_TRAVERSAL_AXES,
  DOCUMENT_GRAPH_EDGE_KINDS,
  DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
  DOCUMENT_GRAPH_NODE_KINDS,
  ENVELOPE_FIELD_AXIS_MAP,
  getTraversalPreset,
  isDocumentGraphNodeKind,
  isTraversalAxis,
  isTraversalDirection,
  isTraversalPresetId,
  TRAVERSAL_AXIS_PRIORITY,
  TRAVERSAL_DIRECTIONS,
  TRAVERSAL_PRESET_IDS,
  TRAVERSAL_PRESETS,
} from "./index.js";

describe("docs-control-plane graph taxonomy", () => {
  it("defines canonical traversal axes separately from direction", () => {
    expect(CANONICAL_TRAVERSAL_AXES).toEqual([
      "composition",
      "refinement",
      "dependency",
      "constraint",
      "trace",
      "source",
      "evidence",
      "role",
      "context",
    ]);
    expect(TRAVERSAL_DIRECTIONS).toEqual(["out", "in", "both"]);

    for (const direction of TRAVERSAL_DIRECTIONS) {
      expect(CANONICAL_TRAVERSAL_AXES).not.toContain(direction);
      expect(isTraversalDirection(direction)).toBe(true);
    }
    expect(isTraversalAxis("dependency")).toBe(true);
    expect(isTraversalAxis("in")).toBe(false);
  });

  it("keeps node roles separate from edge kinds", () => {
    expect(DOCUMENT_GRAPH_NODE_KINDS).toEqual([
      "spec",
      "todo",
      "plan",
      "rule",
      "cases",
      "test",
      "memo",
      "knowledge",
      "prd",
      "ralph-prd-json",
      "ralph-session",
      "source",
      "evidence",
      "section",
    ]);
    expect(DOCUMENT_GRAPH_EDGE_KINDS).toEqual([
      "authored-link",
      "document-constraint",
      "document-source",
      "document-evidence",
      "task-trace",
      "task-evidence",
      "section-membership",
      "role-membership",
      "context-metadata",
    ]);
    expect(DOCUMENT_GRAPH_EDGE_KINDS).not.toContain("spec");
    expect(DOCUMENT_GRAPH_EDGE_KINDS).not.toContain("rule");
    expect(DOCUMENT_GRAPH_FAMILY_ROLE_TYPES).toEqual([
      "spec",
      "todo",
      "plan",
      "rule",
      "cases",
      "test",
      "memo",
      "knowledge",
    ]);
    expect(isDocumentGraphNodeKind("ralph-session")).toBe(true);
    expect(isDocumentGraphNodeKind("authored-link")).toBe(false);
  });

  it("maps source-owned authored relations into canonical axes", () => {
    expect(AUTHORED_LINK_AXIS_MAP).toEqual({
      contains: "composition",
      refines: "refinement",
      depends_on: "dependency",
      constrains: "constraint",
      traces_to: "trace",
      implements: "trace",
      evolves_from: "trace",
      supersedes: "trace",
      verifies: "evidence",
      materializes_output: "evidence",
    });

    expect(ENVELOPE_FIELD_AXIS_MAP).toMatchObject({
      sources: "source",
      sourceRefs: "source",
      verifiesRefs: "evidence",
      materializesOutputRefs: "evidence",
      verificationRefs: "evidence",
      tasks: "trace",
      familyId: "role",
      tags: "context",
      scope: "context",
      aspect: "context",
      layer: "context",
    });

    for (const axis of Object.values(AUTHORED_LINK_AXIS_MAP)) {
      expect(CANONICAL_TRAVERSAL_AXES).toContain(axis);
    }
    for (const axis of Object.values(ENVELOPE_FIELD_AXIS_MAP)) {
      expect(CANONICAL_TRAVERSAL_AXES).toContain(axis);
    }
  });

  it("defines traversal presets as convenience views over canonical axes", () => {
    const expectedPresets = [
      {
        id: "family",
        axes: ["role", "composition"],
        direction: "both",
        defaultDepth: 2,
        includeContext: false,
      },
      {
        id: "implementation",
        axes: ["trace", "source", "evidence"],
        direction: "both",
        defaultDepth: 2,
        includeContext: false,
      },
      {
        id: "review",
        axes: ["dependency", "constraint", "evidence", "role"],
        direction: "both",
        defaultDepth: 2,
        includeContext: false,
      },
      {
        id: "impact",
        axes: ["dependency", "trace", "source", "evidence"],
        direction: "in",
        defaultDepth: 2,
        includeContext: false,
      },
      {
        id: "prd-completion",
        axes: ["trace", "source", "evidence"],
        direction: "both",
        defaultDepth: 2,
        includeContext: false,
      },
    ] as const;

    expect(TRAVERSAL_PRESETS.map((preset) => preset.id)).toEqual([
      ...TRAVERSAL_PRESET_IDS,
    ]);
    expect(TRAVERSAL_PRESETS.map((preset) => ({
      id: preset.id,
      axes: preset.axes,
      direction: preset.direction,
      defaultDepth: preset.defaultDepth,
      includeContext: preset.includeContext,
    }))).toEqual(expectedPresets);

    for (const expected of expectedPresets) {
      expect(getTraversalPreset(expected.id)).toMatchObject(expected);
    }

    for (const preset of TRAVERSAL_PRESETS) {
      expect(isTraversalPresetId(preset.id)).toBe(true);
      expect(isTraversalDirection(preset.direction)).toBe(true);
      expect(preset.includeContext).toBe(false);
      expect(preset.axes).not.toContain("context");
      for (const axis of preset.axes) {
        expect(isTraversalAxis(axis)).toBe(true);
      }
    }
  });

  it("keeps context as the lowest-priority axis", () => {
    const priorities = CANONICAL_TRAVERSAL_AXES.map((axis) => TRAVERSAL_AXIS_PRIORITY[axis]);

    expect(TRAVERSAL_AXIS_PRIORITY.context).toBe(Math.max(...priorities));
    expect(getTraversalPreset("implementation").axes).not.toContain("context");
    expect(getTraversalPreset("review").axes).not.toContain("context");
    expect(getTraversalPreset("prd-completion").axes).not.toContain("context");
  });
});
