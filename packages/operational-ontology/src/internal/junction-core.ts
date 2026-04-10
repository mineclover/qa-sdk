import type {
  BranchHandlingMode,
  BranchPath,
} from "./runtime-core.js";

export const JUNCTION_TEMPLATE_KINDS = [
  "conditional_branch",
  "observed_route_decision",
] as const;

export type JunctionTemplateKind = (typeof JUNCTION_TEMPLATE_KINDS)[number];

export interface JunctionTemplate {
  kind: JunctionTemplateKind;
  description: string;
  allowedModes?: readonly BranchHandlingMode[];
  minPaths?: number;
  maxPaths?: number;
  requireConditionOnPaths?: boolean;
}

export interface JunctionTemplateRegistry {
  list(): JunctionTemplate[];
  get(kind: JunctionTemplateKind): JunctionTemplate | undefined;
}

export const DEFAULT_JUNCTION_TEMPLATES = {
  conditional_branch: {
    kind: "conditional_branch",
    description: "Junction materialized from conditional PipeConnection paths",
    allowedModes: ["first_match", "all_matches", "fallback", "optional"],
    minPaths: 1,
  },
  observed_route_decision: {
    kind: "observed_route_decision",
    description: "Route decision materialized from observed branch outcomes",
    allowedModes: ["first_match", "all_matches", "fallback", "optional"],
    minPaths: 1,
  },
} as const satisfies Record<JunctionTemplateKind, JunctionTemplate>;

export interface JunctionTemplateValidationResult {
  valid: boolean;
  pathCount: number;
  disallowedMode?: BranchHandlingMode;
  tooFewPaths?: boolean;
  tooManyPaths?: boolean;
  pathsMissingCondition: string[];
}

export interface BranchDefinition {
  templateKind: JunctionTemplateKind;
  templateDescription?: string;
  templateValidation?: JunctionTemplateValidationResult;
  branchNodeId: string;
  mode: BranchHandlingMode;
  paths: BranchPath[];
}

export type JunctionDefinition = BranchDefinition;

export interface BranchDecision {
  templateKind?: JunctionTemplateKind;
  templateDescription?: string;
  templateValidation?: JunctionTemplateValidationResult;
  branchNodeId: string;
  mode: BranchHandlingMode;
  selectedPathIds: string[];
  skippedPathIds: string[];
  reason?: string;
  junctionId?: string;
  corridorId?: string;
  traversalKey?: string;
}

export type RouteDecision = BranchDecision;

export const defaultJunctionTemplateRegistry: JunctionTemplateRegistry = {
  list() {
    return Object.values(DEFAULT_JUNCTION_TEMPLATES);
  },
  get(kind: JunctionTemplateKind) {
    return DEFAULT_JUNCTION_TEMPLATES[kind];
  },
};

export function getJunctionTemplate(
  registry: JunctionTemplateRegistry,
  kind: JunctionTemplateKind,
): JunctionTemplate {
  const template = registry.get(kind);
  if (!template) {
    throw new Error(`Unknown junction template "${kind}"`);
  }
  return template;
}

export function validateJunctionAgainstTemplate(
  mode: BranchHandlingMode,
  template: JunctionTemplate,
  paths: readonly BranchPath[],
): JunctionTemplateValidationResult {
  const allowedModes = template.allowedModes;
  const pathCount = paths.length;
  const tooFewPaths =
    typeof template.minPaths === "number" ? pathCount < template.minPaths : false;
  const tooManyPaths =
    typeof template.maxPaths === "number" ? pathCount > template.maxPaths : false;
  const pathsMissingCondition = template.requireConditionOnPaths
    ? paths.filter((path) => !path.when).map((path) => path.pathId)
    : [];

  if (allowedModes && !allowedModes.includes(mode)) {
    return {
      valid: false,
      pathCount,
      disallowedMode: mode,
      tooFewPaths,
      tooManyPaths,
      pathsMissingCondition,
    };
  }

  return {
    valid: !tooFewPaths && !tooManyPaths && pathsMissingCondition.length === 0,
    pathCount,
    tooFewPaths,
    tooManyPaths,
    pathsMissingCondition,
  };
}
