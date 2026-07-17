import { readFileSync } from 'node:fs';
import type { ApiImpactFinding, ImpactConfidence } from './api-impact-model.js';

export interface ImpactPolicyOptions {
  minimumConfidence?: ImpactConfidence;
  strict?: boolean;
  baselineKeys?: ReadonlySet<string>;
}

export interface ImpactPolicyResult {
  findings: ApiImpactFinding[];
  summary: {
    total: number;
    visible: number;
    confidenceExcluded: number;
    baselineExcluded: number;
    advisory: number;
    reviewRequired: number;
    gateBlocking: number;
  };
}

const CONFIDENCE_RANK: Record<ImpactConfidence, number> = {
  heuristic: 1,
  transitive: 2,
  di: 3,
  direct: 4,
};

export function evaluateImpactPolicy(
  findings: readonly ApiImpactFinding[],
  options: ImpactPolicyOptions = {},
): ImpactPolicyResult {
  let confidenceExcluded = 0;
  let baselineExcluded = 0;
  const visibleFindings: ApiImpactFinding[] = [];

  for (const finding of findings) {
    if (
      options.minimumConfidence &&
      CONFIDENCE_RANK[finding.confidence] < CONFIDENCE_RANK[options.minimumConfidence]
    ) {
      confidenceExcluded++;
      continue;
    }
    if (options.baselineKeys?.has(findingKey(finding))) {
      baselineExcluded++;
      continue;
    }
    visibleFindings.push(finding);
  }

  const reviewRequired = visibleFindings.filter(
    (finding) => finding.status === 'confirmed' && finding.confidence !== 'heuristic',
  ).length;
  const advisory = visibleFindings.length - reviewRequired;

  return {
    findings: visibleFindings,
    summary: {
      total: findings.length,
      visible: visibleFindings.length,
      confidenceExcluded,
      baselineExcluded,
      advisory,
      reviewRequired,
      gateBlocking: options.strict ? reviewRequired : 0,
    },
  };
}

export function findingKey(
  finding: Pick<ApiImpactFinding, 'serviceId' | 'api' | 'changedFile' | 'changedSymbols'>,
): string {
  return [
    finding.serviceId,
    finding.api,
    finding.changedFile,
    [...finding.changedSymbols].sort().join(','),
  ].join('|');
}

export function readBaselineKeys(filePath: string): ReadonlySet<string> {
  const document = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  const entries = Array.isArray(document)
    ? document
    : isRecord(document) && Array.isArray(document.affectedApis)
      ? document.affectedApis
      : [];
  const keys = entries.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (!isRecord(entry)) return [];
    if (typeof entry.key === 'string') return [entry.key];
    if (
      typeof entry.serviceId === 'string' &&
      typeof entry.api === 'string' &&
      typeof entry.changedFile === 'string' &&
      Array.isArray(entry.changedSymbols) &&
      entry.changedSymbols.every((symbol): symbol is string => typeof symbol === 'string')
    ) {
      return [
        findingKey({
          serviceId: entry.serviceId,
          api: entry.api,
          changedFile: entry.changedFile,
          changedSymbols: entry.changedSymbols,
        }),
      ];
    }
    return [];
  });
  return new Set(keys);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
