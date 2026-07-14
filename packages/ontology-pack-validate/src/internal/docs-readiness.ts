// @def.boundary deterministic-label-architecture
import { basename } from 'node:path';

import type { DocumentEnvelope, DocumentSource } from 'doc-envelope';
import type {
  OntologyPackValidateDocsReadiness,
  OntologyPackValidateFileRef,
  OntologyPackValidateIssue,
  OntologyPackValidateSourceMapReadiness,
} from './types.js';

export type OntologyPackDocsFamilyReader = (input: {
  readonly packId: string;
  readonly rootDir: string;
}) => Promise<readonly DocumentEnvelope[]>;

export interface OntologyPackDocsReadiness {
  readonly docs: OntologyPackValidateDocsReadiness;
  readonly sourceMap: OntologyPackValidateSourceMapReadiness;
  readonly issues: readonly OntologyPackValidateIssue[];
}

export async function collectDocsReadiness(input: {
  readonly packId: string;
  readonly rootDir: string;
  readonly fileRefs: readonly OntologyPackValidateFileRef[];
  readonly readDocsFamily?: OntologyPackDocsFamilyReader;
}): Promise<OntologyPackDocsReadiness> {
  const docs = input.readDocsFamily
    ? await input.readDocsFamily({ packId: input.packId, rootDir: input.rootDir })
    : [];
  if (docs.length === 0) {
    return emptyDocsReadiness(input.packId);
  }

  const docsSummary = docs.map((doc) => ({
    docId: docIdOf(doc),
    kind: doc.kind,
    path: doc.path,
    sourceCount: doc.sources.length,
  }));
  const sourcesByPath = new Map<string, Set<string>>();
  for (const doc of docs) {
    for (const source of doc.sources) {
      const sourcePath = sourcePathOf(source);
      if (!sourcePath) continue;
      const docsForSource = sourcesByPath.get(sourcePath) ?? new Set<string>();
      docsForSource.add(docIdOf(doc));
      sourcesByPath.set(sourcePath, docsForSource);
    }
  }

  const checkedRefs = uniqueStrings(input.fileRefs.map((ref) => ref.path));
  const coverage = checkedRefs.map((path) => {
    const docIds = [...(sourcesByPath.get(path) ?? new Set<string>())].toSorted();
    return { path, covered: docIds.length > 0, docIds };
  });
  const coveredRefs = coverage.filter((item) => item.covered).map((item) => item.path);
  const missingRefs = coverage.filter((item) => !item.covered).map((item) => item.path);
  const sourceMapStatus =
    checkedRefs.length === 0
      ? 'skipped'
      : missingRefs.length === 0
        ? 'ready'
        : coveredRefs.length > 0
          ? 'partial'
          : 'missing';
  const docsStatus =
    docs.length > 0 && sourceMapStatus === 'ready'
      ? 'ready'
      : docs.length > 0
        ? 'partial'
        : 'missing';
  const familyId = `${input.packId}-system`;
  const sourceMapIssues: OntologyPackValidateIssue[] = missingRefs.map((path) => ({
    level: 'warning',
    source: 'source-map',
    path: `readiness.sourceMap.${path}`,
    code: 'source-map-missing',
    message: `Matching docs family does not declare source-map coverage for "${path}".`,
    details: {
      familyId,
    },
  }));

  return {
    docs: {
      status: docsStatus,
      familyId,
      matchingDocs: docsSummary,
    },
    sourceMap: {
      status: sourceMapStatus,
      checkedRefs,
      coveredRefs,
      missingRefs,
      coverage,
    },
    issues: sourceMapIssues,
  };
}

export function emptyDocsReadiness(packId: string | null): OntologyPackDocsReadiness {
  return {
    docs: {
      status: 'skipped',
      familyId: packId ? `${packId}-system` : '',
      matchingDocs: [],
    },
    sourceMap: {
      status: 'skipped',
      checkedRefs: [],
      coveredRefs: [],
      missingRefs: [],
      coverage: [],
    },
    issues: [],
  };
}

export function filterMatchingDocsForPack(
  packId: string,
  docs: readonly DocumentEnvelope[],
): readonly DocumentEnvelope[] {
  const prefix = `${packId}-`;
  const systemDocId = `${packId}-system`;

  return docs
    .filter((doc) => {
      const docId = docIdOf(doc);
      const file = basename(doc.path);
      return (
        docId === systemDocId ||
        docId.startsWith(prefix) ||
        file === `${systemDocId}.spec.md` ||
        file.startsWith(prefix)
      );
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

function sourcePathOf(source: DocumentSource): string | null {
  if (!source.path) return null;
  return source.path.replaceAll('\\', '/');
}

function docIdOf(doc: DocumentEnvelope): string {
  return typeof doc.metadata['defId'] === 'string' ? doc.metadata['defId'] : doc.stableId;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].toSorted();
}
