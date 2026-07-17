import type { ImplementationSite } from './endpoint-mapper.js';

export type ImpactConfidence = 'direct' | 'di' | 'transitive' | 'heuristic';
export type ImpactStatus = 'confirmed' | 'candidate' | 'unconfirmed';
export type ImpactEvidenceKind = 'controller' | 'import' | 'di' | 'call' | 'consumer' | 'fallback';

export interface ApiImpactEvidence {
  kind: ImpactEvidenceKind;
  serviceId?: string;
  filePath: string;
  symbol?: string;
  lineNumber?: number;
  detail: string;
}

export interface ApiImpactFinding {
  api: string;
  serviceId: string;
  operationId?: string;
  method: string;
  path: string;
  entryPoint: {
    filePath: string;
    className: string;
    methodName: string;
    lineNumber: number;
  };
  changedFile: string;
  changedSymbols: string[];
  status: ImpactStatus;
  confidence: ImpactConfidence;
  reason: string;
  evidence: ApiImpactEvidence[];
  consumers: string[];
}

export interface CreateImpactFindingInput {
  api: string;
  site: ImplementationSite;
  changedFile: string;
  changedSymbols?: string[];
  status: ImpactStatus;
  confidence: ImpactConfidence;
  reason: string;
  evidence: ApiImpactEvidence[];
  consumers: string[];
}

export function createImpactFinding(input: CreateImpactFindingInput): ApiImpactFinding {
  return {
    api: input.api,
    serviceId: input.site.serviceId ?? 'unknown',
    ...(input.site.operationId ? { operationId: input.site.operationId } : {}),
    method: input.site.method,
    path: input.site.path,
    entryPoint: {
      filePath: input.site.filePath,
      className: input.site.className,
      methodName: input.site.methodName,
      lineNumber: input.site.lineNumber,
    },
    changedFile: input.changedFile,
    changedSymbols: input.changedSymbols ?? [],
    status: input.status,
    confidence: input.confidence,
    reason: input.reason,
    evidence: input.evidence,
    consumers: input.consumers,
  };
}
