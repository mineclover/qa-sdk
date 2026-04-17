import type { KnownOntologyPackId } from "../known-ontology-packs.js";

export type OntologyPackValidateIssueLevel = "error" | "warning";

export type OntologyPackValidateIssueSource =
  | "blueprint"
  | "docs"
  | "file"
  | "governance_taxonomy"
  | "loader"
  | "pack"
  | "resolver"
  | "schema"
  | "source-map";

export interface OntologyPackValidateIssue {
  readonly level: OntologyPackValidateIssueLevel;
  readonly source: OntologyPackValidateIssueSource;
  readonly path: string;
  readonly code: string;
  readonly message: string;
  readonly blueprintId?: string;
  readonly details?: Record<string, unknown>;
}

export interface OntologyPackValidateResolution {
  readonly kind: "file-path" | "known-pack" | "unresolved";
  readonly packRef: string;
  readonly knownPackId?: KnownOntologyPackId;
  readonly filePath?: string;
  readonly supportedFilePath?: string;
}

export interface OntologyPackValidateRuntimeSummary {
  readonly valid: boolean;
  readonly issueCount: number;
}
