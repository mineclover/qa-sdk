// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { relative, resolve } from 'node:path';
import { createDataSource, type DataSourceOptions } from 'definition-data-source';
import type { DefDataSource } from 'definition-catalog';
import type { FeedbackRelatedDoc, FeedbackRelatedDocResolution } from 'review-ledger';

export interface RelatedDocsForFileResolution {
  relatedDocs: FeedbackRelatedDoc[];
  resolution?: FeedbackRelatedDocResolution;
}

export interface RelatedDocsResolutionResult {
  relatedDocsByFile: Record<string, FeedbackRelatedDoc[]>;
  relatedDocResolutionsByFile: Record<string, FeedbackRelatedDocResolution>;
}

export async function resolveRelatedDocsForFilesWithResolution(
  cwd: string,
  filePaths: readonly string[],
  options: DataSourceOptions = {},
): Promise<RelatedDocsResolutionResult> {
  let source: DefDataSource | null = null;
  try {
    source = await createDataSource({
      ...options,
      rootDir: cwd,
    });
  } catch {
    return {
      relatedDocsByFile: {},
      relatedDocResolutionsByFile: {},
    };
  }

  try {
    if (!source) {
      return {
        relatedDocsByFile: {},
        relatedDocResolutionsByFile: {},
      };
    }
    if (source.mode === 'scan') {
      return {
        relatedDocsByFile: {},
        relatedDocResolutionsByFile: {},
      };
    }
    const activeSource = source;
    const relatedDocsByFile: Record<string, FeedbackRelatedDoc[]> = {};
    const relatedDocResolutionsByFile: Record<string, FeedbackRelatedDocResolution> = {};
    for (const filePath of filePaths) {
      const resolved = await resolveRelatedDocsForFileWithResolution(cwd, filePath, activeSource);
      relatedDocsByFile[filePath] = resolved.relatedDocs;
      if (resolved.resolution) {
        relatedDocResolutionsByFile[filePath] = resolved.resolution;
      }
    }
    return {
      relatedDocsByFile,
      relatedDocResolutionsByFile,
    };
  } finally {
    if ('close' in source && typeof source.close === 'function') {
      (source as { close(): void }).close();
    }
  }
}

export async function resolveRelatedDocsForFiles(
  cwd: string,
  filePaths: readonly string[],
  options: DataSourceOptions = {},
): Promise<Record<string, FeedbackRelatedDoc[]>> {
  return (await resolveRelatedDocsForFilesWithResolution(cwd, filePaths, options))
    .relatedDocsByFile;
}

export async function resolveRelatedDocsForFileWithResolution(
  cwd: string,
  filePath: string,
  source: DefDataSource,
): Promise<RelatedDocsForFileResolution> {
  if (source.mode === 'scan') return { relatedDocs: [] };

  const normalizedPath = relative(cwd, resolve(cwd, filePath)).replaceAll('\\', '/');
  const mapping = await source.resolveByFile(normalizedPath);
  if (mapping.kind === 'none') {
    return {
      relatedDocs: [],
      resolution: {
        kind: 'none',
        codePath: mapping.codePath,
      },
    };
  }
  if (mapping.kind === 'ambiguous') {
    return {
      relatedDocs: [],
      resolution: {
        kind: 'ambiguous',
        codePath: mapping.codePath,
        candidateDocIds: mapping.candidates.map((candidate) => candidate.anchor.docId),
      },
    };
  }

  const reason = mapping.kind === 'evidence-only' ? 'file-evidence' : 'file-hint';
  const docs =
    mapping.kind === 'evidence-only'
      ? mapping.supportingDocs
      : mapping.supportingDocs.length === 1
        ? mapping.supportingDocs
        : [mapping.anchor];

  return {
    relatedDocs: docs.map((doc) => ({
      docId: doc.docId,
      scope: doc.scope ?? 'unknown',
      aspect: doc.aspect ?? 'unknown',
      depth: doc.depth ?? 'unknown',
      reason,
      ...(doc.purpose ? { purpose: doc.purpose } : {}),
    })),
  };
}

export async function resolveRelatedDocsForFile(
  cwd: string,
  filePath: string,
  source: DefDataSource,
): Promise<FeedbackRelatedDoc[]> {
  return (await resolveRelatedDocsForFileWithResolution(cwd, filePath, source)).relatedDocs;
}
