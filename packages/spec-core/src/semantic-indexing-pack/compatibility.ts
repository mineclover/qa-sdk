// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import { classifySemanticIndexingPackChanges } from './classify.js';
import { validateSemanticIndexingPackManifest } from './manifest.js';
import type {
  SemanticIndexingChangeKind,
  SemanticIndexingCompatibilityReport,
  SemanticIndexingCompatibilityVerdict,
  SemanticIndexingPackManifest,
  SemanticIndexingSurfaceChangeInput,
} from './types.js';

const VERSION_TRANSITION_CHANGE_KINDS = new Set<SemanticIndexingChangeKind>([
  'axis-entry-meaning-change',
  'prefix-shape-change',
  'capacity-change',
  'version-transition',
]);

const REVIEW_CHANGE_KINDS = new Set<SemanticIndexingChangeKind>([
  'entry-add',
  'axis-add',
  'transition-add',
  'feedback-proposal',
  'unknown',
]);

function escalate(
  current: SemanticIndexingCompatibilityVerdict,
  candidate: SemanticIndexingCompatibilityVerdict,
): SemanticIndexingCompatibilityVerdict {
  const rank: Record<SemanticIndexingCompatibilityVerdict, number> = {
    compatible: 0,
    'review-required': 1,
    'version-transition-required': 2,
    invalid: 3,
  };
  return rank[candidate] > rank[current] ? candidate : current;
}

function changeVerdict(
  changeKind: SemanticIndexingChangeKind,
): SemanticIndexingCompatibilityVerdict {
  if (changeKind === 'invalid') return 'invalid';
  if (VERSION_TRANSITION_CHANGE_KINDS.has(changeKind)) return 'version-transition-required';
  if (REVIEW_CHANGE_KINDS.has(changeKind)) return 'review-required';
  return 'compatible';
}

function reasonFor(changeKind: SemanticIndexingChangeKind): string | undefined {
  if (changeKind === 'prefix-shape-change')
    return 'prefix-shape-change requires coordinate version transition';
  if (changeKind === 'capacity-change')
    return 'capacity-change requires coordinate version transition';
  if (changeKind === 'axis-entry-meaning-change') {
    return 'axis-entry-meaning-change requires coordinate version transition';
  }
  if (changeKind === 'version-transition') return 'version-transition requires coordinate review';
  if (changeKind === 'invalid') return 'invalid change requires manual repair';
  if (REVIEW_CHANGE_KINDS.has(changeKind))
    return `${changeKind} requires semantic indexing pack review`;
  return undefined;
}

export function evaluateSemanticIndexingCompatibility(
  manifest: SemanticIndexingPackManifest,
  changes: readonly SemanticIndexingSurfaceChangeInput[],
): SemanticIndexingCompatibilityReport {
  const validation = validateSemanticIndexingPackManifest(manifest);
  const classifiedChanges = classifySemanticIndexingPackChanges(manifest, changes);
  const reasons: string[] = [];
  let verdict: SemanticIndexingCompatibilityVerdict = validation.valid ? 'compatible' : 'invalid';

  if (!validation.valid) {
    reasons.push('manifest validation failed');
  }

  for (const change of classifiedChanges) {
    const nextVerdict = changeVerdict(change.changeKind);
    verdict = escalate(verdict, nextVerdict);
    const reason = reasonFor(change.changeKind);
    if (reason) reasons.push(reason);
  }

  return {
    verdict,
    reasons,
    validation,
    changes: classifiedChanges,
  };
}
