// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import {
  SEMANTIC_INDEXING_PLANES,
  type SemanticIndexingPackManifest,
  type SemanticIndexingPackValidationIssue,
  type SemanticIndexingPackValidationResult,
} from './types.js';

function issue(code: string, message: string, path: string): SemanticIndexingPackValidationIssue {
  return { level: 'error', code, message, path };
}

export function validateSemanticIndexingPackManifest(
  manifest: SemanticIndexingPackManifest,
): SemanticIndexingPackValidationResult {
  const issues: SemanticIndexingPackValidationIssue[] = [];

  if (manifest.packId.trim().length === 0) {
    issues.push(
      issue(
        'semantic-indexing-pack-id-empty',
        'Semantic indexing pack id must not be empty',
        'packId',
      ),
    );
  }

  if (manifest.version.trim().length === 0) {
    issues.push(
      issue(
        'semantic-indexing-pack-version-empty',
        'Semantic indexing pack version must not be empty',
        'version',
      ),
    );
  }

  const seenPlanes = new Set<string>();
  const duplicatePlanes = new Set<string>();
  for (const plane of manifest.planes) {
    if (seenPlanes.has(plane.plane)) duplicatePlanes.add(plane.plane);
    seenPlanes.add(plane.plane);
  }

  for (const plane of duplicatePlanes) {
    issues.push(
      issue(
        'semantic-indexing-plane-duplicate',
        `Semantic indexing pack plane "${plane}" is declared more than once`,
        `planes.${plane}`,
      ),
    );
  }

  for (const plane of SEMANTIC_INDEXING_PLANES) {
    if (!seenPlanes.has(plane)) {
      issues.push(
        issue(
          'semantic-indexing-plane-missing',
          `Semantic indexing pack must declare the "${plane}" plane`,
          `planes.${plane}`,
        ),
      );
    }
  }

  const seenRefs = new Set<string>();
  const duplicateRefs = new Set<string>();
  for (const plane of manifest.planes) {
    for (const ref of plane.refs) {
      if (seenRefs.has(ref.id)) duplicateRefs.add(ref.id);
      seenRefs.add(ref.id);
    }
  }

  for (const refId of duplicateRefs) {
    issues.push(
      issue(
        'semantic-indexing-ref-duplicate',
        `Semantic indexing pack ref "${refId}" is declared more than once`,
        `refs.${refId}`,
      ),
    );
  }

  return {
    valid: issues.every((candidate) => candidate.level !== 'error'),
    issues,
  };
}
