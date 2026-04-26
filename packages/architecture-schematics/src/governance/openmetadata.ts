import type { CacheKeyDefinition } from "./cache-key-dsl.js";

export interface OpenMetadataDomainSeed {
  readonly name: string;
  readonly team: string;
  readonly owner: string;
}

export interface OpenMetadataGlossaryTerm {
  readonly term: string;
  readonly description: string;
}

export interface OpenMetadataLineageEdge {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly via: string;
}

export interface OpenMetadataQualityTest {
  readonly name: string;
  readonly type: "columnNullCount" | "columnValuesToBeInSet" | "tableRowCount" | "customSql";
  readonly entity: string;
  readonly values?: readonly string[];
  readonly maxNullCount?: number;
  readonly sql?: string;
}

export interface OpenMetadataSeed {
  readonly domain: OpenMetadataDomainSeed;
  readonly glossary: readonly OpenMetadataGlossaryTerm[];
  readonly lineage: readonly OpenMetadataLineageEdge[];
  readonly qualityTests: readonly OpenMetadataQualityTest[];
}

export interface GovernanceManifest {
  readonly openmetadata: OpenMetadataSeed;
  readonly cacheKeys: readonly CacheKeyDefinition[];
}

export interface GovernanceValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function validateGovernanceManifest(manifest: GovernanceManifest): readonly GovernanceValidationIssue[] {
  const issues: GovernanceValidationIssue[] = [];
  const glossary = new Set(manifest.openmetadata.glossary.map((term) => term.term));

  if (!manifest.openmetadata.domain.name) {
    issues.push({ path: "openmetadata.domain.name", message: "OpenMetadata domain name is required." });
  }
  if (!manifest.openmetadata.domain.team) {
    issues.push({ path: "openmetadata.domain.team", message: "OpenMetadata team is required." });
  }
  if (!manifest.openmetadata.domain.owner) {
    issues.push({ path: "openmetadata.domain.owner", message: "OpenMetadata owner is required." });
  }
  if (glossary.size === 0) {
    issues.push({ path: "openmetadata.glossary", message: "At least one glossary term is required." });
  }
  if (manifest.openmetadata.lineage.length === 0) {
    issues.push({ path: "openmetadata.lineage", message: "At least one lineage edge is required." });
  }
  if (manifest.openmetadata.qualityTests.length === 0) {
    issues.push({ path: "openmetadata.qualityTests", message: "At least one data quality test is required." });
  }

  for (const test of manifest.openmetadata.qualityTests) {
    if (!test.entity.includes(".")) {
      issues.push({ path: `openmetadata.qualityTests.${test.name}`, message: "Quality test entity must be FQN-like." });
    }
  }

  for (const cacheKey of manifest.cacheKeys) {
    if (cacheKey.openmetadataEntity && !cacheKey.openmetadataEntity.includes(".")) {
      issues.push({ path: `cacheKeys.${cacheKey.id}`, message: "OpenMetadata entity mapping must be FQN-like." });
    }
  }

  return issues;
}

