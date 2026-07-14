// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type {
  OntologyPackSourceMapCandidate,
  OntologyPackSourceMapFrontmatterCandidate,
  OntologyPackSourceMapGuidance,
} from '../ontology-pack-scaffold-plan.js';

type SourceRole = OntologyPackSourceMapCandidate['sourceRole'];

export interface OntologyPackSourceMapSourceInput {
  readonly sourcePath: string;
  readonly sourceRole: SourceRole;
}

export interface OntologyPackSourceMapDocInput {
  readonly docId: string;
  readonly docPath: string;
  readonly sources: readonly OntologyPackSourceMapSourceInput[];
}

export interface OntologyPackSourceMapPlanInput {
  readonly primaryDoc: OntologyPackSourceMapDocInput;
  readonly additionalDocs?: readonly OntologyPackSourceMapDocInput[];
}

export interface OntologyPackSourceMapPlan {
  readonly candidates: readonly OntologyPackSourceMapCandidate[];
  readonly frontmatterCandidates: readonly OntologyPackSourceMapFrontmatterCandidate[];
  readonly guidance: OntologyPackSourceMapGuidance;
}

export function createOntologyPackSourceMapPlan(
  input: OntologyPackSourceMapPlanInput,
): OntologyPackSourceMapPlan {
  const docs = [input.primaryDoc, ...(input.additionalDocs ?? [])];
  const candidates = docs.flatMap((doc) =>
    doc.sources.map((source) =>
      sourceMapCandidate({
        docId: doc.docId,
        docPath: doc.docPath,
        sourcePath: source.sourcePath,
        sourceRole: source.sourceRole,
      }),
    ),
  );
  const frontmatterCandidates = docs.map((doc) => ({
    docId: doc.docId,
    docPath: doc.docPath,
    frontmatterKey: 'sources' as const,
    candidateKind: 'suggested-doc-edit' as const,
    targetKind: 'definition-doc-frontmatter' as const,
    applyMode: 'candidate-only' as const,
    sources: doc.sources.map((source) => source.sourcePath),
    yaml: renderSourcesYaml(doc.sources.map((source) => source.sourcePath)),
  }));

  return {
    candidates,
    frontmatterCandidates,
    guidance: createSourceMapGuidance(
      input.primaryDoc.docId,
      candidates.map((candidate) => candidate.sourcePath),
    ),
  };
}

function sourceMapCandidate(
  input: Omit<
    OntologyPackSourceMapCandidate,
    'applyMode' | 'candidateKind' | 'frontmatterKey' | 'sourceFileKind'
  >,
): OntologyPackSourceMapCandidate {
  return {
    ...input,
    frontmatterKey: 'sources',
    sourceFileKind: 'generated-file',
    candidateKind: 'suggested-doc-edit',
    applyMode: 'candidate-only',
  };
}

function createSourceMapGuidance(
  definitionId: string,
  sourcePaths: readonly string[],
): OntologyPackSourceMapGuidance {
  const uniqueSourcePaths = [...new Set(sourcePaths)];
  return {
    summary:
      'Review the sources frontmatter candidates, run qa-sdk def sync, then verify source coverage with def find-by-file and docs graph.',
    findByFileCommands: uniqueSourcePaths.map(
      (sourcePath) => `qa-sdk def find-by-file ${sourcePath}`,
    ),
    docsGraphCommands: [
      `qa-sdk docs graph ${definitionId} --axis source`,
      ...uniqueSourcePaths.map((sourcePath) => `qa-sdk docs graph ${sourcePath} --axis source`),
    ],
    notes: [
      'Source-map candidates use repository-relative normalized paths.',
      'Generated TypeScript files do not receive @def.boundary/<doc-id> or @def.doc/<doc-id> source comments by default.',
    ],
  };
}

function renderSourcesYaml(sources: readonly string[]): string {
  return ['sources:', ...sources.map((source) => `  - ${source}`)].join('\n');
}
