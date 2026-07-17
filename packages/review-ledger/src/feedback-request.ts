// @def.boundary system-root
import { randomUUID } from 'node:crypto';
import type {
  CreateFeedbackRequestInput,
  EvidenceBundle,
  EvidenceBundleItem,
  FeedbackRelatedDoc,
  FeedbackRequest,
  FileReviewStatus,
} from './types.js';

export function buildEvidenceBundle(
  statuses: readonly FileReviewStatus[],
  relatedDocsByFile: Record<string, FeedbackRelatedDoc[]> = {},
  relatedDocResolutionsByFile: CreateFeedbackRequestInput['relatedDocResolutionsByFile'] = {},
): EvidenceBundle {
  const items: EvidenceBundleItem[] = statuses.map((status) => {
    const resolution = relatedDocResolutionsByFile?.[status.filePath];
    return {
      filePath: status.filePath,
      serviceScope: status.serviceScope,
      status: status.status,
      latestFileCommit: status.latestFileCommit,
      reviewedCommit: status.lastEntry?.reviewedCommit ?? null,
      reviewedAt: status.lastEntry?.reviewedAt ?? null,
      reviewer: status.lastEntry?.reviewer ?? null,
      aiModel: status.lastEntry?.aiModel ?? null,
      notes: status.lastEntry?.notes ?? null,
      relatedDocs: relatedDocsByFile[status.filePath] ?? [],
      ...(resolution ? { relatedDocResolution: resolution } : {}),
    };
  });

  return {
    total: items.length,
    reviewed: items.filter((item) => item.status === 'reviewed').length,
    stale: items.filter((item) => item.status === 'stale').length,
    unreviewed: items.filter((item) => item.status === 'unreviewed').length,
    items,
  };
}

export function createFeedbackRequest(
  input: CreateFeedbackRequestInput,
  evidenceBundle: EvidenceBundle,
): FeedbackRequest {
  const inferredScope = inferServiceScope(input.serviceScope, evidenceBundle);

  return {
    id: `frq_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    createdAt: new Date().toISOString(),
    requestedBy: input.requestedBy,
    purpose: input.purpose,
    targetModel: input.targetModel ?? null,
    serviceScope: inferredScope,
    status: 'open',
    notes: input.notes ?? null,
    prompt: renderFeedbackPrompt({
      purpose: input.purpose,
      requestedBy: input.requestedBy,
      targetModel: input.targetModel ?? null,
      serviceScope: inferredScope,
      notes: input.notes ?? null,
      evidenceBundle,
    }),
    evidenceBundle,
  };
}

export function renderFeedbackPrompt(input: {
  purpose: string;
  requestedBy: string;
  targetModel: string | null;
  serviceScope: string | null;
  notes: string | null;
  evidenceBundle: EvidenceBundle;
}): string {
  const lines: string[] = [];

  lines.push('# Feedback Request');
  lines.push('');
  lines.push(`Purpose: ${input.purpose}`);
  lines.push(`Requested By: ${input.requestedBy}`);
  if (input.targetModel) {
    lines.push(`Target Model: ${input.targetModel}`);
  }
  if (input.serviceScope) {
    lines.push(`Scope: ${input.serviceScope}`);
  }
  if (input.notes) {
    lines.push(`Notes: ${input.notes}`);
  }
  lines.push('');
  lines.push('## Evidence Summary');
  lines.push(`- total files: ${input.evidenceBundle.total}`);
  lines.push(`- reviewed: ${input.evidenceBundle.reviewed}`);
  lines.push(`- stale: ${input.evidenceBundle.stale}`);
  lines.push(`- unreviewed: ${input.evidenceBundle.unreviewed}`);
  lines.push('');
  lines.push('## Files');

  for (const item of input.evidenceBundle.items) {
    const tail = [
      item.serviceScope,
      item.latestFileCommit ? `latest=${item.latestFileCommit.slice(0, 7)}` : null,
      item.reviewedCommit ? `reviewed=${item.reviewedCommit.slice(0, 7)}` : null,
      item.reviewer ? `by=${item.reviewer}` : null,
      item.aiModel ? `model=${item.aiModel}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    lines.push(`- [${item.status}] ${item.filePath}${tail ? ` (${tail})` : ''}`);
    if (item.notes) {
      lines.push(`  note: ${item.notes}`);
    }
    if ((item.relatedDocs ?? []).length > 0) {
      lines.push(
        `  docs: ${(item.relatedDocs ?? [])
          .map((doc) => `${doc.docId} [${doc.reason}]`)
          .join(', ')}`,
      );
    }
    if (item.relatedDocResolution) {
      const detail =
        item.relatedDocResolution.kind === 'ambiguous'
          ? ` candidates=${item.relatedDocResolution.candidateDocIds.join(',')}`
          : '';
      lines.push(`  definition resolution: ${item.relatedDocResolution.kind}${detail}`);
    }
  }

  lines.push('');
  lines.push('## Requested Output');
  lines.push('- Evaluate the evidence bundle as the current source of truth.');
  lines.push('- Identify concrete gaps, risks, and inconsistencies.');
  lines.push('- Recommend next actions grounded in the listed files and review states.');

  return lines.join('\n');
}

function inferServiceScope(
  explicitScope: string | undefined,
  evidenceBundle: EvidenceBundle,
): string | null {
  if (explicitScope) return explicitScope;

  const scopes = new Set(evidenceBundle.items.map((item) => item.serviceScope));
  if (scopes.size === 1) {
    return evidenceBundle.items[0]?.serviceScope ?? null;
  }
  return null;
}
