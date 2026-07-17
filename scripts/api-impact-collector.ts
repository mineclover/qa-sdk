import { basename, resolve } from 'node:path';
import {
  createImpactFinding,
  type ApiImpactEvidence,
  type ApiImpactFinding,
} from './api-impact-model.js';
import {
  findDependencyPath,
  findMethodReachability,
  methodBodyContainsToken,
  type AstDependencyGraph,
} from './api-impact-ast.js';
import type { ConsumerMatch } from './api-impact-consumers.js';
import type { ImplementationSite } from './endpoint-mapper.js';

export interface CollectImpactFindingsOptions {
  resolveConsumers?: (site: ImplementationSite, root: string) => ConsumerMatch[];
  dependencyGraph?: AstDependencyGraph;
  changedSymbols?: ReadonlyMap<string, readonly string[]>;
}

export function collectImpactFindings(
  changedFiles: readonly string[],
  implementationMap: ReadonlyMap<string, ImplementationSite>,
  root: string,
  options: CollectImpactFindingsOptions = {},
): ApiImpactFinding[] {
  const resolveConsumers = options.resolveConsumers ?? (() => []);
  const impactReport: ApiImpactFinding[] = [];

  for (const file of changedFiles) {
    const absPath = resolve(root, file);
    const fileName = basename(file);
    const changedSymbols = options.changedSymbols?.get(absPath) ?? [];

    for (const site of implementationMap.values()) {
      const api = site.api;
      if (site.filePath === absPath) {
        const consumerMatches = resolveConsumers(site, root);
        const consumers = consumerFiles(consumerMatches);
        impactReport.push(
          createImpactFinding({
            api,
            site,
            changedFile: file,
            changedSymbols: [...changedSymbols],
            status: 'confirmed',
            confidence: 'direct',
            reason: 'Direct implementation change (Controller)',
            evidence: [
              {
                kind: 'controller',
                filePath: site.filePath,
                symbol: `${site.className}.${site.methodName}`,
                lineNumber: site.lineNumber,
                detail: 'changed file is the mapped endpoint controller',
              },
              ...consumerEvidence(consumerMatches, site.serviceId),
            ],
            consumers,
          }),
        );
        continue;
      }

      const structuralFinding = findStructuralFinding({
        api,
        site,
        changedFile: file,
        targetFilePath: absPath,
        root,
        changedSymbols,
        dependencyGraph: options.dependencyGraph,
        resolveConsumers,
      });
      if (structuralFinding) {
        impactReport.push(structuralFinding);
        continue;
      }

      if (!isIndirectDependencyFile(file)) continue;

      const simplifiedClassName = getSimplifiedClassName(fileName);
      try {
        if (
          !methodBodyContainsToken(
            site.filePath,
            site.className,
            site.methodName,
            simplifiedClassName,
          )
        ) {
          continue;
        }
        const consumerMatches = resolveConsumers(site, root);
        const consumers = consumerFiles(consumerMatches);

        impactReport.push(
          createImpactFinding({
            api,
            site,
            changedFile: file,
            changedSymbols: [...changedSymbols],
            status: 'unconfirmed',
            confidence: 'heuristic',
            reason: `Heuristic candidate via source token: ${simplifiedClassName}`,
            evidence: [
              {
                kind: 'fallback',
                filePath: site.filePath,
                symbol: simplifiedClassName,
                detail: `controller source contains "${simplifiedClassName}"; import/DI/call evidence is not confirmed`,
              },
              ...consumerEvidence(consumerMatches, site.serviceId),
            ],
            consumers,
          }),
        );
      } catch {
        /* ignore unreadable implementation sites */
      }
    }
  }

  return impactReport;
}

interface StructuralFindingInput {
  api: string;
  site: ImplementationSite;
  changedFile: string;
  targetFilePath: string;
  root: string;
  changedSymbols: readonly string[];
  dependencyGraph?: AstDependencyGraph;
  resolveConsumers: (site: ImplementationSite, root: string) => ConsumerMatch[];
}

function findStructuralFinding(input: StructuralFindingInput): ApiImpactFinding | null {
  if (!input.dependencyGraph) return null;

  const methodReachability = findMethodReachability(
    input.dependencyGraph,
    {
      filePath: input.site.filePath,
      className: input.site.className,
      methodName: input.site.methodName,
    },
    input.targetFilePath,
    input.changedSymbols,
  );
  const dependencyPath = methodReachability
    ? methodReachability.dependencyEdges
    : findDependencyPath(input.dependencyGraph, input.site.filePath, input.targetFilePath);
  if (!dependencyPath && !methodReachability) return null;

  const depth = dependencyPath?.length ?? methodReachability?.dependencyEdges.length ?? 1;
  const confidence = depth > 1 ? 'transitive' : 'di';
  const methodReachabilityConfirmed = methodReachability !== null;
  const evidence: ApiImpactEvidence[] = [
    ...(dependencyPath ?? []).map((edge) => ({
      kind: 'di' as const,
      filePath: edge.fromFilePath,
      symbol: edge.dependencyName,
      lineNumber: edge.lineNumber,
      detail: `constructor dependency resolves to ${edge.targetFilePath ?? 'an unresolved provider'}`,
    })),
    ...(methodReachability?.methodCalls ?? []).map((call) => ({
      kind: 'call' as const,
      filePath: call.fromFilePath,
      symbol: `${call.fromClassName}.${call.fromMethodName}`,
      lineNumber: call.lineNumber,
      detail: `calls ${call.dependencyName}.${call.targetMethodName}`,
    })),
  ];
  const consumerMatches = input.resolveConsumers(input.site, input.root);
  const consumers = consumerFiles(consumerMatches);

  return createImpactFinding({
    api: input.api,
    site: input.site,
    changedFile: input.changedFile,
    changedSymbols: [...input.changedSymbols],
    status: methodReachabilityConfirmed ? 'confirmed' : 'candidate',
    confidence,
    reason: methodReachabilityConfirmed
      ? `Structural impact via ${confidence} dependency`
      : `Structural dependency found; changed method reachability is unconfirmed`,
    evidence: [...evidence, ...consumerEvidence(consumerMatches, input.site.serviceId)],
    consumers,
  });
}

function isIndirectDependencyFile(file: string): boolean {
  return /(?:service|repository|entity|use[-.]case|query(?:[-.]handler)?|command(?:[-.]handler)?|port|adapter|module|handler|resolver|gateway)\.tsx?$/.test(
    file,
  );
}

function getSimplifiedClassName(fileName: string): string {
  const className = fileName
    .replace(/\.(?:tsx?|mts|cts)$/, '')
    .split(/[.-]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return className.replace(
    /(Service|Repository|Entity|UseCase|QueryHandler|Query|CommandHandler|Command|Port|Adapter|Module|Handler|Resolver|Gateway)$/,
    '',
  );
}

function consumerEvidence(
  matches: readonly ConsumerMatch[],
  serviceId: string | undefined,
): ApiImpactEvidence[] {
  return matches.map((match) => ({
    kind: 'consumer',
    serviceId: serviceId ?? 'unknown',
    filePath: match.filePath,
    lineNumber: match.lineNumber,
    detail: `${match.kind}: ${match.detail}`,
  }));
}

function consumerFiles(matches: readonly ConsumerMatch[]): string[] {
  return Array.from(new Set(matches.map((match) => match.filePath)));
}
