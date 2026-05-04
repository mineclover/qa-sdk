// @def.boundary deterministic-label-architecture
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

export interface OntologyPackValidateFileRef {
  readonly kind: "implementation" | "test";
  readonly ref: string;
  readonly path: string;
  readonly absolutePath: string;
  readonly exists: boolean;
  readonly source: "blueprint" | "scaffold-metadata";
  readonly surfaceKind?: string;
  readonly blueprintId?: string;
}

export interface OntologyPackValidateFileReadiness {
  readonly status: "missing" | "ready" | "skipped";
  readonly checked: readonly OntologyPackValidateFileRef[];
  readonly missing: readonly OntologyPackValidateFileRef[];
}

export interface OntologyPackValidateDocsReadiness {
  readonly status: "missing" | "partial" | "ready" | "skipped";
  readonly familyId: string;
  readonly matchingDocs: readonly {
    readonly docId: string;
    readonly kind: string;
    readonly path: string;
    readonly sourceCount: number;
  }[];
}

export interface OntologyPackValidateSourceMapReadiness {
  readonly status: "missing" | "partial" | "ready" | "skipped";
  readonly checkedRefs: readonly string[];
  readonly coveredRefs: readonly string[];
  readonly missingRefs: readonly string[];
  readonly coverage: readonly {
    readonly path: string;
    readonly covered: boolean;
    readonly docIds: readonly string[];
  }[];
}

export interface OntologyPackValidateReadiness {
  readonly implementationFiles: OntologyPackValidateFileReadiness;
  readonly testFiles: OntologyPackValidateFileReadiness;
  readonly docs: OntologyPackValidateDocsReadiness;
  readonly sourceMap: OntologyPackValidateSourceMapReadiness;
}
