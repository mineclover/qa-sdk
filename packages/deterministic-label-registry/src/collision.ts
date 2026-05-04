// @def.doc deterministic-label-architecture
import {
  semanticCoordinateDiagnostic,
  type SemanticCoordinateCandidate,
  type SemanticCoordinateDiagnostic,
} from "./coordinate.js";

/**
 * Collision 감지 system — 같은 label을 서로 다른 physical record가 생산하는 경우를
 * warning으로 surfacing. records 수 자체에 의미를 부여하지 않으므로 severity는 단일
 * (warning). 생성 시점 dedupe은 현재 비채택 (stability-boundary.memo 결정 1 참조).
 */

export function detectSemanticCoordinateCandidateCollisions(
  candidates: readonly SemanticCoordinateCandidate[],
): readonly SemanticCoordinateDiagnostic[] {
  const byLabel = new Map<string, SemanticCoordinateCandidate[]>();

  for (const candidate of candidates) {
    const existing = byLabel.get(candidate.label) ?? [];
    existing.push(candidate);
    byLabel.set(candidate.label, existing);
  }

  return [...byLabel.entries()]
    .filter(([, matches]) => matches.length > 1)
    .flatMap(([label, matches]) => {
      const signatures = new Set(matches.map(candidateCollisionSignature));
      if (signatures.size <= 1) return [];
      return [
        semanticCoordinateDiagnostic({
          code: "semantic-coordinate-collision-candidate",
          severity: "warning",
          label,
          message: `Semantic coordinate candidate ${label} is produced by ${matches.length} distinct physical records.`,
          metadata: {
            candidates: matches.map((candidate) => ({
              id: candidate.id,
              kind: candidate.kind,
              subtype: candidate.subtype,
              physicalRefs: candidate.physicalRefs.map((ref) => ref.ref),
            })),
          },
        }),
      ];
    });
}

function candidateCollisionSignature(
  candidate: SemanticCoordinateCandidate,
): string {
  const physicalRefs = candidate.physicalRefs
    .map((ref) => `${ref.kind}:${ref.ref}`)
    .toSorted()
    .join("|");
  return [
    candidate.kind,
    candidate.id,
    candidate.parentId ?? "",
    physicalRefs,
  ].join("\u001f");
}
