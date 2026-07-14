// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { basename, dirname, join, normalize } from 'node:path';

import type { CompletedRecordState, DocumentEnvelope } from 'doc-envelope';

import {
  buildCompletedRecordCleanupReview,
  type CompletedRecordCleanupAction,
  type CompletedRecordCleanupCandidate,
} from './completed-record-review.js';

export type CompletedRecordCleanupPlanAction =
  | 'archive'
  | 'memo-conversion'
  | 'promote-spec'
  | 'rewrite';

export interface CompletedRecordCleanupPathOverrides {
  readonly outputPath?: string;
  readonly secondaryOutputPath?: string;
  readonly assimilationTargetPath?: string;
  readonly appendMarkdown?: string;
  readonly bodyTemplate?: string;
  readonly frontmatterPatch?: {
    readonly level?: string;
    readonly scope?: string;
    readonly aspect?: string;
    readonly depth?: string;
    readonly layer?: string;
    readonly lifecycle?: string;
    readonly svc?: string;
    readonly tags?: readonly string[];
    readonly links?: readonly {
      readonly target: string;
      readonly type: string;
    }[];
  };
}

export interface CompletedRecordCleanupPlan {
  readonly action: CompletedRecordCleanupPlanAction;
  readonly dryRunDefaulted: boolean;
  readonly record: CompletedRecordState;
  readonly candidate: CompletedRecordCleanupCandidate;
  readonly target: string;
  readonly targetValidatedAs: 'record-path' | 'document-id' | 'paired-path';
  readonly proposedOutputPath: string;
  readonly secondaryOutputPath?: string;
  readonly assimilationTargetPath?: string;
  readonly appendMarkdown?: string;
  readonly bodyTemplate?: string;
  readonly frontmatterPatch?: {
    readonly level?: string;
    readonly scope?: string;
    readonly aspect?: string;
    readonly depth?: string;
    readonly layer?: string;
    readonly lifecycle?: string;
    readonly svc?: string;
    readonly tags?: readonly string[];
    readonly links?: readonly {
      readonly target: string;
      readonly type: string;
    }[];
  };
  readonly recommendationMatchesAction: boolean;
  readonly preservedEvidencePaths: readonly string[];
  readonly relatedDocumentPaths: readonly string[];
  readonly validationCommands: readonly string[];
  readonly steps: readonly string[];
  readonly warnings: readonly string[];
}

export interface BuildCompletedRecordCleanupPlanOptions {
  readonly documents: readonly DocumentEnvelope[];
  readonly completedRecords: readonly CompletedRecordState[];
  readonly target: string;
  readonly action: CompletedRecordCleanupPlanAction;
  readonly dryRunDefaulted: boolean;
  readonly overrides?: CompletedRecordCleanupPathOverrides;
}

export function buildCompletedRecordCleanupPlan(
  options: BuildCompletedRecordCleanupPlanOptions,
): CompletedRecordCleanupPlan | null {
  const review = buildCompletedRecordCleanupReview({
    documents: options.documents,
    completedRecords: options.completedRecords,
  });
  const resolution = resolveCleanupCandidate(review.candidates, options.target);
  if (!resolution) return null;

  const renderedOverrides = renderCleanupOverrides(resolution.candidate, options.overrides);
  const targetPaths = planTargetPaths(
    resolution.candidate,
    options.documents,
    options.action,
    renderedOverrides.overrides,
  );
  if (!targetPaths) return null;
  const preservedEvidencePaths = unique([
    resolution.candidate.record.path,
    resolution.candidate.record.pairedPath,
    ...resolution.candidate.relatedDocuments.map((document) => document.path),
  ]);
  const relatedDocumentPaths = unique(
    resolution.candidate.relatedDocuments.map((document) => document.path),
  );
  const recommendationMatchesAction = matchesRecommendation(
    resolution.candidate.recommendation.action,
    options.action,
  );
  const warnings = [
    ...renderedOverrides.warnings,
    ...cleanupPlanWarnings(resolution.candidate, options.action, targetPaths),
  ];

  return {
    action: options.action,
    dryRunDefaulted: options.dryRunDefaulted,
    record: resolution.candidate.record,
    candidate: resolution.candidate,
    target: options.target,
    targetValidatedAs: resolution.validatedAs,
    proposedOutputPath: targetPaths.primary,
    ...(targetPaths.secondary ? { secondaryOutputPath: targetPaths.secondary } : {}),
    ...(targetPaths.assimilationTarget
      ? { assimilationTargetPath: targetPaths.assimilationTarget }
      : {}),
    ...(renderedOverrides.overrides.appendMarkdown
      ? { appendMarkdown: renderedOverrides.overrides.appendMarkdown }
      : {}),
    ...(renderedOverrides.overrides.bodyTemplate
      ? { bodyTemplate: renderedOverrides.overrides.bodyTemplate }
      : {}),
    ...(renderedOverrides.overrides.frontmatterPatch
      ? { frontmatterPatch: renderedOverrides.overrides.frontmatterPatch }
      : {}),
    recommendationMatchesAction,
    preservedEvidencePaths,
    relatedDocumentPaths,
    validationCommands: cleanupValidationCommands(resolution.candidate, options.action),
    steps: cleanupPlanSteps(resolution.candidate, options.action, targetPaths),
    warnings,
  };
}

function renderCleanupOverrides(
  candidate: CompletedRecordCleanupCandidate,
  overrides: CompletedRecordCleanupPathOverrides | undefined,
): {
  readonly overrides: CompletedRecordCleanupPathOverrides;
  readonly warnings: readonly string[];
} {
  if (!overrides) return { overrides: {}, warnings: [] };

  const warnings: string[] = [];
  return {
    overrides: {
      ...(overrides.outputPath
        ? { outputPath: renderCleanupTemplate(overrides.outputPath, candidate, warnings) }
        : {}),
      ...(overrides.secondaryOutputPath
        ? {
            secondaryOutputPath: renderCleanupTemplate(
              overrides.secondaryOutputPath,
              candidate,
              warnings,
            ),
          }
        : {}),
      ...(overrides.assimilationTargetPath
        ? {
            assimilationTargetPath: renderCleanupTemplate(
              overrides.assimilationTargetPath,
              candidate,
              warnings,
            ),
          }
        : {}),
      ...(overrides.appendMarkdown
        ? { appendMarkdown: renderCleanupTemplate(overrides.appendMarkdown, candidate, warnings) }
        : {}),
      ...(overrides.bodyTemplate ? { bodyTemplate: overrides.bodyTemplate } : {}),
      ...(overrides.frontmatterPatch
        ? {
            frontmatterPatch: renderCleanupFrontmatterPatch(
              overrides.frontmatterPatch,
              candidate,
              warnings,
            ),
          }
        : {}),
    },
    warnings,
  };
}

function renderCleanupFrontmatterPatch(
  patch: NonNullable<CompletedRecordCleanupPathOverrides['frontmatterPatch']>,
  candidate: CompletedRecordCleanupCandidate,
  warnings: string[],
): NonNullable<CompletedRecordCleanupPathOverrides['frontmatterPatch']> {
  return {
    ...(patch.level ? { level: renderCleanupTemplate(patch.level, candidate, warnings) } : {}),
    ...(patch.scope ? { scope: renderCleanupTemplate(patch.scope, candidate, warnings) } : {}),
    ...(patch.aspect ? { aspect: renderCleanupTemplate(patch.aspect, candidate, warnings) } : {}),
    ...(patch.depth ? { depth: renderCleanupTemplate(patch.depth, candidate, warnings) } : {}),
    ...(patch.layer ? { layer: renderCleanupTemplate(patch.layer, candidate, warnings) } : {}),
    ...(patch.lifecycle
      ? { lifecycle: renderCleanupTemplate(patch.lifecycle, candidate, warnings) }
      : {}),
    ...(patch.svc ? { svc: renderCleanupTemplate(patch.svc, candidate, warnings) } : {}),
    ...(patch.tags
      ? { tags: patch.tags.map((tag) => renderCleanupTemplate(tag, candidate, warnings)) }
      : {}),
    ...(patch.links
      ? {
          links: patch.links.map((link) => ({
            target: renderCleanupTemplate(link.target, candidate, warnings),
            type: renderCleanupTemplate(link.type, candidate, warnings),
          })),
        }
      : {}),
  };
}

function renderCleanupTemplate(
  template: string,
  candidate: CompletedRecordCleanupCandidate,
  warnings: string[],
): string {
  const values = cleanupTemplateValues(candidate);
  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) {
      warnings.push(`Unknown cleanup template token: ${key}`);
      return `{{${key}}}`;
    }
    return value;
  });
  return rendered;
}

function cleanupTemplateValues(
  candidate: CompletedRecordCleanupCandidate,
): Readonly<Record<string, string>> {
  const record = candidate.record;
  const primary = candidate.primaryDocument;
  const paired = candidate.pairedDocument;
  return {
    'record.path': record.path,
    'record.documentId': record.documentId,
    'record.kind': record.kind,
    'record.title': record.title,
    'record.basename': basenameWithoutMarkdown(record.path),
    ...(record.pairedPath ? { 'record.pairedPath': record.pairedPath } : {}),
    ...(record.lifecycle ? { 'record.lifecycle': record.lifecycle } : {}),
    ...(candidate.familyId ? { 'candidate.familyId': candidate.familyId } : {}),
    ...(primary
      ? {
          'primary.path': primary.path,
          'primary.stableId': primary.stableId,
          'primary.title': primary.title,
        }
      : {}),
    ...(paired
      ? {
          'paired.path': paired.path,
          'paired.stableId': paired.stableId,
          'paired.title': paired.title,
        }
      : {}),
  };
}

function basenameWithoutMarkdown(path: string): string {
  const normalized = normalizePath(path);
  const base = basename(normalized);
  return base.replace(/\.md$/i, '');
}

function resolveCleanupCandidate(
  candidates: readonly CompletedRecordCleanupCandidate[],
  target: string,
): {
  readonly candidate: CompletedRecordCleanupCandidate;
  readonly validatedAs: CompletedRecordCleanupPlan['targetValidatedAs'];
} | null {
  const byPath = candidates.find((candidate) => candidate.record.path === target);
  if (byPath) return { candidate: byPath, validatedAs: 'record-path' };

  const byId = candidates.find((candidate) => candidate.record.documentId === target);
  if (byId) return { candidate: byId, validatedAs: 'document-id' };

  const byPairedPath = candidates.find((candidate) => candidate.record.pairedPath === target);
  if (byPairedPath) return { candidate: byPairedPath, validatedAs: 'paired-path' };

  return null;
}

function planTargetPaths(
  candidate: CompletedRecordCleanupCandidate,
  documents: readonly DocumentEnvelope[],
  action: CompletedRecordCleanupPlanAction,
  overrides: CompletedRecordCleanupPathOverrides = {},
): {
  readonly primary: string;
  readonly secondary?: string;
  readonly assimilationTarget?: string;
} | null {
  if (action === 'archive') {
    return {
      primary: overrides.outputPath ?? archiveOutputPath(candidate.record.path),
      ...(overrides.secondaryOutputPath || candidate.record.pairedPath
        ? {
            secondary:
              overrides.secondaryOutputPath ?? archiveOutputPath(candidate.record.pairedPath!),
          }
        : {}),
    };
  }

  if (action === 'memo-conversion') {
    if (candidate.record.kind === 'todo' && !candidate.record.pairedPath) {
      return {
        primary: overrides.outputPath ?? memoOutputPath(candidate.record.path),
      };
    }
    if (candidate.record.kind === 'prd' && candidate.record.pairedPath) {
      return {
        primary: overrides.outputPath ?? memoOutputPath(candidate.record.path),
        secondary: overrides.secondaryOutputPath ?? archiveOutputPath(candidate.record.pairedPath),
      };
    }
  }

  if (action === 'promote-spec') {
    const specTarget = overrides.assimilationTargetPath
      ? (documents.find(
          (document) =>
            document.path === overrides.assimilationTargetPath && document.kind === 'spec',
        ) ?? null)
      : uniqueAssimilationSpec(candidate);
    if (!specTarget) return null;
    return {
      primary: overrides.outputPath ?? specTarget.path,
      secondary: overrides.secondaryOutputPath ?? archiveOutputPath(candidate.record.path),
      assimilationTarget: overrides.assimilationTargetPath ?? specTarget.path,
    };
  }

  if (action === 'rewrite') {
    if (
      !overrides.outputPath &&
      !overrides.secondaryOutputPath &&
      !overrides.assimilationTargetPath &&
      !overrides.appendMarkdown &&
      !overrides.bodyTemplate &&
      !overrides.frontmatterPatch
    ) {
      return null;
    }
    return {
      primary: overrides.outputPath ?? candidate.record.path,
      ...(overrides.secondaryOutputPath ? { secondary: overrides.secondaryOutputPath } : {}),
      ...(overrides.assimilationTargetPath
        ? { assimilationTarget: overrides.assimilationTargetPath }
        : {}),
    };
  }

  return null;
}

function archiveOutputPath(path: string): string {
  const normalizedPath = normalizePath(path);
  if (normalizedPath.startsWith('tasks/')) {
    return normalizePath(join('tasks/archive', normalizedPath.slice('tasks/'.length)));
  }
  return normalizePath(join(dirname(normalizedPath), 'archive', basename(normalizedPath)));
}

function memoOutputPath(path: string): string {
  const normalizedPath = normalizePath(path);
  if (normalizedPath.endsWith('.todo.md')) {
    return normalizedPath.replace(/\.todo\.md$/i, '.memo.md');
  }
  if (normalizedPath.endsWith('.md')) {
    return normalizedPath.replace(/\.md$/i, '.memo.md');
  }
  return `${normalizedPath}.memo.md`;
}

function matchesRecommendation(
  recommendation: CompletedRecordCleanupAction,
  action: CompletedRecordCleanupPlanAction,
): boolean {
  return (
    (recommendation === 'archive-review' && action === 'archive') ||
    (recommendation === 'memo-conversion-review' && action === 'memo-conversion') ||
    (recommendation === 'keep-as-evidence' && action === 'archive') ||
    (recommendation === 'promote-spec-review' && action === 'promote-spec') ||
    action === 'rewrite'
  );
}

function cleanupValidationCommands(
  candidate: CompletedRecordCleanupCandidate,
  action: CompletedRecordCleanupPlanAction,
): readonly string[] {
  const specTarget = action === 'promote-spec' ? uniqueAssimilationSpec(candidate) : undefined;
  return unique([
    `qa-sdk docs cleanup review ${candidate.record.path} --json`,
    candidate.record.pairedPath
      ? `qa-sdk docs drift --prd ${candidate.record.pairedPath} --json`
      : undefined,
    (specTarget?.stableId ?? candidate.primaryDocument?.stableId)
      ? `qa-sdk docs status ${(specTarget?.stableId ?? candidate.primaryDocument?.stableId)!} --family-only --json`
      : undefined,
    action === 'archive'
      ? `qa-sdk docs collect ${candidate.record.path} --family-only --json`
      : undefined,
    action === 'promote-spec'
      ? `qa-sdk docs collect ${candidate.record.path} --family-only --json`
      : undefined,
  ]);
}

function cleanupPlanSteps(
  candidate: CompletedRecordCleanupCandidate,
  action: CompletedRecordCleanupPlanAction,
  targetPaths: {
    readonly primary: string;
    readonly secondary?: string;
    readonly assimilationTarget?: string;
  },
): readonly string[] {
  if (action === 'archive') {
    return [
      `Validate the completed record with docs cleanup review for ${candidate.record.path}.`,
      `Move ${candidate.record.path} to ${targetPaths.primary} through an explicit write workflow.`,
      'Preserve related source/evidence links or rewrite them only with explicit target validation.',
    ];
  }
  if (action === 'memo-conversion') {
    return [
      `Validate the completed record with docs cleanup review for ${candidate.record.path}.`,
      `Convert ${candidate.record.path} into memo form at ${targetPaths.primary} through an explicit write workflow.`,
      ...(targetPaths.secondary
        ? [
            `Move paired execution JSON to ${targetPaths.secondary} so runtime evidence remains archived.`,
          ]
        : []),
      'Preserve durable rationale and review notes; do not silently promote TODO content into specs.',
    ];
  }
  if (action === 'rewrite') {
    return [
      `Validate the completed record with docs cleanup review for ${candidate.record.path}.`,
      ...(targetPaths.primary !== candidate.record.path
        ? [`Move ${candidate.record.path} to ${targetPaths.primary}.`]
        : ['Rewrite the completed record in place.']),
      ...(targetPaths.secondary ? [`Move paired record to ${targetPaths.secondary}.`] : []),
      ...(targetPaths.assimilationTarget
        ? [`Apply assimilation rewrite to ${targetPaths.assimilationTarget}.`]
        : []),
      'Apply body/frontmatter overrides only to explicit rewrite targets.',
    ];
  }
  return [
    `Validate the completed record with docs cleanup review for ${candidate.record.path}.`,
    `Assimilate completed TODO facts into ${targetPaths.assimilationTarget ?? targetPaths.primary}.`,
    `Move the completed TODO record to ${targetPaths.secondary ?? archiveOutputPath(candidate.record.path)} after spec promotion succeeds.`,
    'Preserve source/test evidence and keep promotion explicit; do not silently rewrite unrelated family documents.',
  ];
}

function cleanupPlanWarnings(
  candidate: CompletedRecordCleanupCandidate,
  action: CompletedRecordCleanupPlanAction,
  targetPaths: {
    readonly primary: string;
    readonly secondary?: string;
    readonly assimilationTarget?: string;
  },
): readonly string[] {
  const warnings: string[] = [];
  if (!matchesRecommendation(candidate.recommendation.action, action)) {
    warnings.push(
      `Requested ${action} does not match cleanup review recommendation ${candidate.recommendation.action}.`,
    );
  }
  if (targetPaths.primary === candidate.record.path) {
    warnings.push(
      'Planned output path matches the current record path; choose a distinct target before writing.',
    );
  }
  if (candidate.record.kind === 'prd' && action === 'memo-conversion') {
    warnings.push(
      'Completed PRD records default to evidence retention; memo conversion needs stronger operator intent.',
    );
  }
  if (action === 'promote-spec' && !uniqueAssimilationSpec(candidate)) {
    warnings.push('Spec promotion requires exactly one same-family non-knowledge spec target.');
  }
  if (
    action === 'rewrite' &&
    targetPaths.primary === candidate.record.path &&
    !targetPaths.assimilationTarget &&
    !targetPaths.secondary
  ) {
    warnings.push('Rewrite action is in-place; confirm the override intent before applying.');
  }
  return warnings;
}

function uniqueAssimilationSpec(
  candidate: CompletedRecordCleanupCandidate,
): CompletedRecordCleanupCandidate['relatedDocuments'][number] | null {
  const specs = candidate.relatedDocuments.filter(
    (document) => document.kind === 'spec' && document.path.endsWith('.spec.md'),
  );
  return specs.length === 1 ? specs[0]! : null;
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizePath(value: string): string {
  return normalize(value).replaceAll('\\', '/');
}
