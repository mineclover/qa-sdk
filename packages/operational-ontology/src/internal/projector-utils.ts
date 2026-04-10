import type {
  EventRecord,
  PipeGraph,
} from "@qa-sdk/core";
import type { InformationFacetKind, TransmissionDirection, TransmissionMedium, TransmissionSemantic } from "./runtime-core.js";

export function normalizePipeEndpoint(
  endpoint: PipeGraph["connections"][number]["from"] | PipeGraph["connections"][number]["to"],
): Array<{ pipeId: string; portId?: string }> {
  const values = Array.isArray(endpoint) ? endpoint : [endpoint];

  return values.map((value) =>
    typeof value === "string"
      ? { pipeId: value }
      : { pipeId: value.pipeId, portId: value.portId },
  );
}

export function mapPipeFlowKindToControlFlowNodeKind(
  kind: PipeGraph["pipes"][number]["flow"]["kind"],
): "step" | "sequence" | "branch" | "optional" | "parallel" | "join" | "retry" | "feedback" | "emit" | "transition_scope" {
  switch (kind) {
    case "step":
      return "step";
    case "branch":
    case "fallback":
      return "branch";
    case "optional":
      return "optional";
    case "parallel":
    case "race":
      return "parallel";
    case "await":
      return "join";
    case "retry":
    case "loop":
    case "timeout":
    case "circuit-breaker":
    case "throttle":
    case "debounce":
      return "retry";
    case "feedback":
      return "feedback";
    case "emit":
      return "emit";
    case "transition-scope":
    case "compensate":
      return "transition_scope";
    default:
      return "sequence";
  }
}

export function mapConnectionKindToControlFlowEdgeKind(
  kind: PipeGraph["connections"][number]["kind"],
): "next" | "conditional" | "event" | "error" | "fan_out" | "join" | "feedback" {
  switch (kind) {
    case "next":
      return "next";
    case "conditional":
      return "conditional";
    case "event":
      return "event";
    case "error":
    case "compensate":
      return "error";
    case "fan-out":
      return "fan_out";
    case "join":
      return "join";
    case "feedback":
      return "feedback";
  }
}

export function normalizeFacetHint(
  hint: string | undefined,
  fallback: InformationFacetKind,
): InformationFacetKind {
  if (!hint) {
    return fallback;
  }

  const normalized = hint.trim().toLowerCase().replace(/[_\-\s]+/g, "");

  if (normalized.includes("manag")) {
    return "management";
  }
  if (
    normalized.includes("produc") ||
    normalized.includes("output") ||
    normalized.includes("emit") ||
    normalized.includes("write")
  ) {
    return "production";
  }
  if (
    normalized.includes("consum") ||
    normalized.includes("input") ||
    normalized.includes("read")
  ) {
    return "consumption";
  }
  if (
    normalized.includes("store") ||
    normalized.includes("persist") ||
    normalized.includes("cache")
  ) {
    return "storage";
  }
  if (
    normalized.includes("defin") ||
    normalized.includes("schema") ||
    normalized.includes("identity")
  ) {
    return "definition";
  }

  return fallback;
}

export function resolvePipeFacetHint(
  pipe: PipeGraph["pipes"][number] | undefined,
  endpoint: { pipeId: string; portId?: string },
  direction: "in" | "out",
): string | undefined {
  if (!pipe) {
    return undefined;
  }

  if (endpoint.portId) {
    const matchedPort = pipe.ports?.find((port) => port.portId === endpoint.portId);
    if (matchedPort?.facetType) {
      return matchedPort.facetType;
    }
  }

  const directionalPort = pipe.ports?.find(
    (port) => port.direction === direction && typeof port.facetType === "string",
  );
  if (directionalPort?.facetType) {
    return directionalPort.facetType;
  }

  if (pipe.flow.kind === "step") {
    return pipe.flow.facet;
  }

  return undefined;
}

export function inferTransmissionSemantic(
  kind: PipeGraph["connections"][number]["kind"],
  sourceFacet: InformationFacetKind,
  targetFacet: InformationFacetKind,
): TransmissionSemantic {
  if (sourceFacet === "definition" || sourceFacet === "management" || targetFacet === "management") {
    return "contract_descent";
  }

  if (sourceFacet === "storage" || targetFacet === "storage") {
    return "storage_projection";
  }

  if (kind === "event" && targetFacet === "consumption") {
    return "production_to_consumption";
  }

  return "production_to_consumption";
}

export function inferTransmissionMedium(
  kind: PipeGraph["connections"][number]["kind"],
  sourceFacet: InformationFacetKind,
  targetFacet: InformationFacetKind,
): TransmissionMedium {
  if (kind === "event") {
    return "event";
  }

  if (sourceFacet === "storage" || targetFacet === "storage") {
    return "projection";
  }

  if (kind === "feedback") {
    return "state";
  }

  return "direct";
}

export function inferTransmissionDirection(
  kind: PipeGraph["connections"][number]["kind"],
): TransmissionDirection {
  if (kind === "feedback") {
    return "bidirectional";
  }

  return "forward";
}

export function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value == null) {
    return "null";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatPipeConstraint(constraint: { field: string; op: string; value?: unknown }): string {
  if (typeof constraint.value === "undefined") {
    return `${constraint.field} ${constraint.op}`;
  }

  return `${constraint.field} ${constraint.op} ${formatUnknownValue(constraint.value)}`;
}

export function inferPayloadType(record: EventRecord): string {
  if (record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)) {
    return `object:${record.payload_format}`;
  }

  return record.payload_format;
}

export function inferValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

export function extractPayloadFields(
  payload: unknown,
): Array<{ field: string; type: string; required: boolean }> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  return Object.entries(payload).map(([field, value]) => ({
    field,
    type: inferValueType(value),
    required: true,
  }));
}
