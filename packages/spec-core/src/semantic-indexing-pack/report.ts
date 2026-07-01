// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import { evaluateSemanticIndexingCompatibility } from "./compatibility.js";
import { sortSemanticIndexingPackSurfaces } from "./sort.js";
import type {
  SemanticIndexingPackReport,
  SemanticIndexingPackReportInput,
  SemanticIndexingPromotionProposalKind,
  SemanticIndexingPromotionSummary,
} from "./types.js";

function summarizePromotions(
  input: SemanticIndexingPackReportInput["promotionProposals"],
): readonly SemanticIndexingPromotionSummary[] {
  const byKind = new Map<
    SemanticIndexingPromotionProposalKind,
    { kind: SemanticIndexingPromotionProposalKind; count: number; terms: string[] }
  >();

  for (const proposal of input ?? []) {
    const summary = byKind.get(proposal.kind) ?? { kind: proposal.kind, count: 0, terms: [] };
    summary.count += 1;
    summary.terms.push(proposal.term);
    byKind.set(proposal.kind, summary);
  }

  return [...byKind.values()].map((summary) => ({
    ...summary,
    terms: [...new Set(summary.terms)].sort((left, right) => left.localeCompare(right)),
  }));
}

export function buildSemanticIndexingPackReport(input: SemanticIndexingPackReportInput): SemanticIndexingPackReport {
  const changes = input.changes ?? [];
  const compatibility = evaluateSemanticIndexingCompatibility(input.manifest, changes);
  const surfaces = sortSemanticIndexingPackSurfaces(
    input.surfaces ?? input.manifest.planes.flatMap((plane) => plane.refs),
  );
  const surfacesByPlane = input.manifest.planes.map((plane) => ({
    plane: plane.plane,
    surfaces: sortSemanticIndexingPackSurfaces(plane.refs),
  }));

  return {
    packId: input.manifest.packId,
    version: input.manifest.version,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    reviewOnly: true,
    validation: compatibility.validation,
    compatibility,
    surfaces,
    surfacesByPlane,
    promotionSummary: summarizePromotions(input.promotionProposals),
    promotionProposals: input.promotionProposals ?? [],
  };
}

export function formatSemanticIndexingPackReportMarkdown(report: SemanticIndexingPackReport): string {
  const lines = [
    "# Semantic Indexing Pack Report",
    "",
    `- Pack: ${report.packId}@${report.version}`,
    `- Generated: ${report.generatedAt}`,
    `- Verdict: ${report.compatibility.verdict}`,
    `- Review-only: ${report.reviewOnly ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...(report.compatibility.reasons.length > 0
      ? report.compatibility.reasons.map((reason) => `- ${reason}`)
      : ["- none"]),
    "",
    "## Surfaces",
    "| id | kind | role | dirty | lastChangedAt | path |",
    "|---|---|---|---|---|---|",
    ...report.surfaces.map((surface) =>
      `| ${surface.id} | ${surface.kind} | ${surface.role ?? "other"} | ${surface.dirty ? "yes" : "no"} | ${surface.lastChangedAt ?? ""} | ${surface.path ?? ""} |`,
    ),
    "",
    "## Promotion Summary",
    ...(report.promotionSummary.length > 0
      ? report.promotionSummary.map((summary) => `- ${summary.kind}: ${summary.count} (${summary.terms.join(", ")})`)
      : ["- none"]),
  ];

  return lines.join("\n");
}
