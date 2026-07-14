// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { PipePort, PipeSpec, PipeStep } from '../types/pipe-spec.js';
import { collectFlowSteps } from './pipe-fold.js';

type ContractFields = Record<string, { type: string; required: boolean }>;

function appendContractPorts(
  ports: PipePort[],
  fields: ContractFields | undefined,
  direction: PipePort['direction'],
): void {
  if (!fields) return;

  for (const [portId, field] of Object.entries(fields)) {
    ports.push({
      direction,
      portId,
      facetType: field.type,
      required: field.required,
    });
  }
}

function inferStepPorts(step: PipeStep): PipePort[] {
  const ports: PipePort[] = [];

  appendContractPorts(ports, step.dataContract?.consumes, 'in');
  appendContractPorts(ports, step.dataContract?.produces, 'out');

  return ports;
}

function dedupePorts(ports: PipePort[]): PipePort[] {
  const deduped: PipePort[] = [];
  const seen = new Map<string, number>();

  for (const port of ports) {
    const key = `${port.direction}:${port.portId}`;
    const existingIndex = seen.get(key);

    if (existingIndex == null) {
      seen.set(key, deduped.length);
      deduped.push({ ...port });
      continue;
    }

    const existing = deduped[existingIndex];
    if (!existing) continue;
    if (existing.facetType == null && port.facetType != null) {
      existing.facetType = port.facetType;
    }
    if (port.required) {
      existing.required = true;
    } else if (existing.required == null && port.required != null) {
      existing.required = port.required;
    }
  }

  return deduped;
}

export function inferPortsFromDataContract(pipe: PipeSpec): PipePort[] {
  return dedupePorts(collectFlowSteps(pipe.flow).flatMap(inferStepPorts));
}

export function resolvePorts(pipe: PipeSpec): PipePort[] {
  return pipe.ports ?? inferPortsFromDataContract(pipe);
}
