// @def.boundary deterministic-label-architecture
import {
  validateOperationalOntologyPack,
  type OperationalOntologyPack,
  type OperationalOntologyPackValidationIssue,
} from "operational-ontology/pack";

import type {
  OntologyPackValidateIssue,
  OntologyPackValidateRuntimeSummary,
} from "./types.js";

export interface OntologyPackRuntimeValidation {
  readonly issues: readonly OntologyPackValidateIssue[];
  readonly summary: OntologyPackValidateRuntimeSummary;
}

export function validateOntologyPackRuntime(
  pack: OperationalOntologyPack,
): OntologyPackRuntimeValidation {
  const issues = validateOperationalOntologyPack(pack).issues.map(runtimeIssueToCliIssue);
  return {
    issues,
    summary: {
      valid: issues.every((issue) => issue.level !== "error"),
      issueCount: issues.length,
    },
  };
}

function runtimeIssueToCliIssue(
  issue: OperationalOntologyPackValidationIssue,
): OntologyPackValidateIssue {
  return {
    level: issue.level,
    source: issue.source,
    path: issue.path,
    code: issue.code,
    message: issue.message,
    ...(issue.blueprintId ? { blueprintId: issue.blueprintId } : {}),
  };
}
