/**
 * PipeSpec / PipeGraph 직렬화
 *
 * JSON 기반. 역직렬화 시 validatePipeSpec/validatePipeGraph로 검증.
 */

import type { PipeSpec, PipeGraph } from "../types/pipe-spec.js";
import { validatePipeSpec, validatePipeGraph } from "./pipe-validate.js";

/** PipeSpec → JSON 문자열 */
export function serializePipeSpec(spec: PipeSpec): string {
  return JSON.stringify(
    {
      ...spec,
      ports: spec.ports,
    },
    null,
    2,
  );
}

/** JSON 문자열 → PipeSpec (검증 포함) */
export function deserializePipeSpec(json: string): PipeSpec {
  const parsed = JSON.parse(json) as PipeSpec;
  const normalized: PipeSpec = {
    ...parsed,
    ports: parsed.ports,
  };
  if (!normalized.pipeId || !normalized.flow) {
    throw new Error("유효하지 않은 PipeSpec: pipeId 또는 flow 누락");
  }
  const issues = validatePipeSpec(normalized);
  const errors = issues.filter(i => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `PipeSpec 검증 실패 (${errors.length}건):\n${errors.map(e => `  ${e.path}: ${e.message}`).join("\n")}`,
    );
  }
  return normalized;
}

/** PipeGraph → JSON 문자열 */
export function serializePipeGraph(graph: PipeGraph): string {
  return JSON.stringify(graph, null, 2);
}

/** JSON 문자열 → PipeGraph (검증 포함) */
export function deserializePipeGraph(json: string): PipeGraph {
  const parsed = JSON.parse(json) as PipeGraph;
  if (!parsed.graphId || !parsed.pipes || !parsed.entryPipeId) {
    throw new Error("유효하지 않은 PipeGraph: graphId, pipes, 또는 entryPipeId 누락");
  }
  const issues = validatePipeGraph(parsed);
  const errors = issues.filter(i => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `PipeGraph 검증 실패 (${errors.length}건):\n${errors.map(e => `  ${e.path}: ${e.message}`).join("\n")}`,
    );
  }
  return parsed;
}
