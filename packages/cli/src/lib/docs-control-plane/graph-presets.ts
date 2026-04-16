import type { TraversalPresetDefinition } from "./graph-types.js";

export const TRAVERSAL_PRESETS = [
  {
    id: "family",
    label: "Family",
    axes: ["role", "composition"],
    direction: "both",
    defaultDepth: 2,
    includeContext: false,
    description: "Same-family role members and immediate composition boundaries.",
  },
  {
    id: "implementation",
    label: "Implementation",
    axes: ["trace", "source", "evidence"],
    direction: "both",
    defaultDepth: 2,
    includeContext: false,
    description: "Implementation traceability across work records, source paths, and evidence.",
  },
  {
    id: "review",
    label: "Review",
    axes: ["dependency", "constraint", "evidence", "role"],
    direction: "both",
    defaultDepth: 2,
    includeContext: false,
    description: "Review-relevant dependency, rule, evidence, and role relationships.",
  },
  {
    id: "impact",
    label: "Impact",
    axes: ["dependency", "trace", "source", "evidence"],
    direction: "in",
    defaultDepth: 2,
    includeContext: false,
    description: "Reverse dependency, trace, source, and evidence relationships.",
  },
  {
    id: "prd-completion",
    label: "PRD Completion",
    axes: ["trace", "source", "evidence"],
    direction: "both",
    defaultDepth: 2,
    includeContext: false,
    description: "PRD completion signals without broad context traversal.",
  },
] as const satisfies readonly TraversalPresetDefinition[];

export function getTraversalPreset(
  id: TraversalPresetDefinition["id"],
): TraversalPresetDefinition {
  return TRAVERSAL_PRESETS.find((preset) => preset.id === id)!;
}
