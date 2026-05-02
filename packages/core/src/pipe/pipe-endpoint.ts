// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { PipeConnection, PortRef } from "../types/pipe-spec.js";

type PipeEndpoint = PipeConnection["from"] | PipeConnection["to"];

export function isPortRef(value: string | PortRef): value is PortRef {
  return typeof value !== "string";
}

export function toEndpointArray(endpoint: PipeEndpoint): Array<string | PortRef> {
  return Array.isArray(endpoint) ? endpoint : [endpoint];
}

export function normalizePortRefs(endpoint: PipeEndpoint): PortRef[] {
  return toEndpointArray(endpoint).map(value => isPortRef(value) ? value : { pipeId: value });
}

export function normalizeEndpointPipeIds(endpoint: PipeEndpoint): string[] {
  return normalizePortRefs(endpoint).map(value => value.pipeId);
}

export function endpointIdentity(value: string | PortRef): string {
  if (isPortRef(value)) {
    return value.portId == null ? value.pipeId : `${value.pipeId}#${value.portId}`;
  }
  return value;
}
