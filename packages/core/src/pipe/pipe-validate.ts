/**
 * PipeSpec / PipeGraph 구조 검증
 */

import type { PipeFlow, PipeSpec, PipeGraph, PortRef } from "../types/pipe-spec.js";
import { isPortRef, normalizeEndpointPipeIds, toEndpointArray } from "./pipe-endpoint.js";

export interface ValidationIssue {
  path: string;
  severity: "error" | "warning";
  message: string;
}

const KNOWN_FACETS = new Set(["생산", "소비", "정의", "관리", "저장"]);

// ── PipeSpec 검증 ─────────────────────────────────────

export function validatePipeSpec(spec: PipeSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!spec.trigger.eventKey) {
    issues.push({ path: "trigger.eventKey", severity: "error", message: "트리거 이벤트 키 누락" });
  }

  validatePorts(spec, issues);
  validateFlow(spec.flow, "flow", issues, 0);
  return issues;
}

function validatePorts(spec: PipeSpec, issues: ValidationIssue[]): void {
  if (!spec.ports) return;

  const seen = new Map<string, number>();

  spec.ports.forEach((port, index) => {
    const key = `${port.direction}:${port.portId}`;
    const prevIndex = seen.get(key);

    if (prevIndex != null) {
      issues.push({
        path: `ports[${index}].portId`,
        severity: "error",
        message: `같은 방향("${port.direction}") 내 중복 portId: "${port.portId}" (기존: ports[${prevIndex}])`,
      });
      return;
    }

    seen.set(key, index);
  });
}

function validateFlow(flow: PipeFlow, path: string, issues: ValidationIssue[], depth: number): void {
  if (depth > 8) {
    issues.push({ path, severity: "warning", message: "흐름 중첩 깊이 > 8" });
  }

  switch (flow.kind) {
    case "step":
      if (flow.facet && !KNOWN_FACETS.has(flow.facet)) {
        issues.push({ path: `${path}.facet`, severity: "warning", message: `알 수 없는 패싯: "${flow.facet}"` });
      }
      break;

    case "sequence":
      if (flow.steps.length === 0) {
        issues.push({ path, severity: "error", message: "sequence.steps 비어있음" });
      }
      flow.steps.forEach((s, i) => validateFlow(s, `${path}.steps[${i}]`, issues, depth + 1));
      break;

    case "branch":
      if (flow.paths.length === 0) {
        issues.push({ path, severity: "error", message: "branch.paths 비어있음" });
      }
      flow.paths.forEach((p, i) => validateFlow(p, `${path}.paths[${i}]`, issues, depth + 1));
      break;

    case "optional":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "parallel":
      if (flow.steps.length === 0) {
        issues.push({ path, severity: "error", message: "parallel.steps 비어있음" });
      }
      flow.steps.forEach((s, i) => validateFlow(s, `${path}.steps[${i}]`, issues, depth + 1));
      break;

    case "race":
      if (flow.steps.length === 0) {
        issues.push({ path, severity: "error", message: "race.steps 비어있음" });
      }
      flow.steps.forEach((s, i) => validateFlow(s, `${path}.steps[${i}]`, issues, depth + 1));
      break;

    case "await":
      validateFlow(flow.then, `${path}.then`, issues, depth + 1);
      break;

    case "retry":
      if (flow.maxAttempts <= 0) {
        issues.push({ path, severity: "error", message: "retry.maxAttempts ≤ 0" });
      }
      // backoff 음수 검증
      if (flow.backoff != null && flow.backoff < 0) {
        issues.push({ path: `${path}.backoff`, severity: "warning", message: "retry.backoff < 0 (음수 백오프)" });
      }
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "fallback":
      validateFlow(flow.try, `${path}.try`, issues, depth + 1);
      validateFlow(flow.catch, `${path}.catch`, issues, depth + 1);
      break;

    case "loop":
      if (flow.maxIterations == null) {
        issues.push({ path, severity: "warning", message: "loop.maxIterations 미설정 (무한 루프 위험)" });
      }
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      break;

    case "compensate":
      validateFlow(flow.forward, `${path}.forward`, issues, depth + 1);
      validateFlow(flow.compensate, `${path}.compensate`, issues, depth + 1);
      break;

    case "finally":
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      validateFlow(flow.cleanup, `${path}.cleanup`, issues, depth + 1);
      break;

    case "timeout":
      if (flow.duration <= 0) {
        issues.push({ path, severity: "error", message: "timeout.duration ≤ 0" });
      }
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      if (flow.onTimeout) validateFlow(flow.onTimeout, `${path}.onTimeout`, issues, depth + 1);
      break;

    // ── 안정화 숫자 범위 검증 (duration은 위에서 error로 처리, 아래는 warning) ──

    case "feedback":
      if (flow.maxIterations == null) {
        issues.push({ path, severity: "warning", message: "feedback.maxIterations 미설정 (무한 루프 위험)" });
      }
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      break;

    case "map":
      // collection 빈 문자열 검증
      if (flow.collection === "") {
        issues.push({ path: `${path}.collection`, severity: "warning", message: "map.collection 빈 문자열" });
      }
      validateFlow(flow.itemFlow, `${path}.itemFlow`, issues, depth + 1);
      break;

    case "reduce":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "buffer":
      if (flow.count == null && flow.duration == null) {
        issues.push({ path, severity: "warning", message: "buffer: count와 duration 모두 미설정" });
      }
      // count 설정 시 양수 검증
      if (flow.count != null && flow.count <= 0) {
        issues.push({ path: `${path}.count`, severity: "warning", message: "buffer.count ≤ 0" });
      }
      // duration 설정 시 양수 검증
      if (flow.duration != null && flow.duration <= 0) {
        issues.push({ path: `${path}.duration`, severity: "warning", message: "buffer.duration ≤ 0" });
      }
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      break;

    case "filter":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "circuit-breaker":
      if (flow.failureThreshold <= 0) {
        issues.push({ path, severity: "error", message: "circuit-breaker.failureThreshold ≤ 0" });
      }
      // cooldown 양수 검증
      if (flow.cooldown <= 0) {
        issues.push({ path: `${path}.cooldown`, severity: "warning", message: "circuit-breaker.cooldown ≤ 0" });
      }
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "throttle":
      // rate, interval 양수 검증
      if (flow.rate <= 0) {
        issues.push({ path: `${path}.rate`, severity: "warning", message: "throttle.rate ≤ 0" });
      }
      if (flow.interval <= 0) {
        issues.push({ path: `${path}.interval`, severity: "warning", message: "throttle.interval ≤ 0" });
      }
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "debounce":
      // wait 양수 검증
      if (flow.wait <= 0) {
        issues.push({ path: `${path}.wait`, severity: "warning", message: "debounce.wait ≤ 0" });
      }
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "split":
      // splitBy 빈 문자열 검증
      if (flow.splitBy === "") {
        issues.push({ path: `${path}.splitBy`, severity: "warning", message: "split.splitBy 빈 문자열" });
      }
      validateFlow(flow.itemFlow, `${path}.itemFlow`, issues, depth + 1);
      break;

    case "enrich":
      // source 빈 문자열 검증
      if (flow.source === "") {
        issues.push({ path: `${path}.source`, severity: "warning", message: "enrich.source 빈 문자열" });
      }
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "tap":
      validateFlow(flow.observe, `${path}.observe`, issues, depth + 1);
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "resequence":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "window":
      // size 양수 검증
      if (flow.size <= 0) {
        issues.push({ path: `${path}.size`, severity: "warning", message: "window.size ≤ 0" });
      }
      // sliding 윈도우일 때 slide 양수 검증
      if (flow.type === "sliding" && flow.slide != null && flow.slide <= 0) {
        issues.push({ path: `${path}.slide`, severity: "warning", message: "window.slide ≤ 0 (sliding 윈도우)" });
      }
      // session 윈도우일 때 gap 양수 검증
      if (flow.type === "session" && flow.gap != null && flow.gap <= 0) {
        issues.push({ path: `${path}.gap`, severity: "warning", message: "window.gap ≤ 0 (session 윈도우)" });
      }
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      break;

    case "dedup":
      // ttl 설정 시 양수 검증
      if (flow.ttl != null && flow.ttl <= 0) {
        issues.push({ path: `${path}.ttl`, severity: "warning", message: "dedup.ttl ≤ 0" });
      }
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "correlation":
      // 요청/응답 이벤트 동일 시 데드락 위험
      if (flow.requestEvent === flow.responseEvent) {
        issues.push({ path, severity: "warning", message: "correlation: requestEvent와 responseEvent 동일 (데드락 위험)" });
      }
      validateFlow(flow.onMatch, `${path}.onMatch`, issues, depth + 1);
      if (flow.onTimeout) validateFlow(flow.onTimeout, `${path}.onTimeout`, issues, depth + 1);
      break;

    case "emit":
      // emit은 단독으로 유효
      break;
  }
}

// ── PipeGraph 검증 ────────────────────────────────────

export function validatePipeGraph(graph: PipeGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pipeIds = new Set(graph.pipes.map(p => p.pipeId));
  const pipeMap = new Map(graph.pipes.map(p => [p.pipeId, p]));

  // 진입점 존재 확인
  if (!pipeIds.has(graph.entryPipeId)) {
    issues.push({ path: "entryPipeId", severity: "error", message: `진입점 "${graph.entryPipeId}"가 pipes에 없음` });
  }

  // 중복 pipeId
  const seen = new Set<string>();
  for (const pipe of graph.pipes) {
    if (seen.has(pipe.pipeId)) {
      issues.push({ path: `pipes`, severity: "error", message: `pipeId "${pipe.pipeId}" 중복` });
    }
    seen.add(pipe.pipeId);
  }

  // 각 PipeSpec 개별 검증
  for (const pipe of graph.pipes) {
    const pipeIssues = validatePipeSpec(pipe);
    for (const issue of pipeIssues) {
      issues.push({ ...issue, path: `pipes[${pipe.pipeId}].${issue.path}` });
    }
  }

  // 연결 검증
  for (let i = 0; i < graph.connections.length; i++) {
    const conn = graph.connections[i];
    const fromValues = toEndpointArray(conn.from);
    const toValues = toEndpointArray(conn.to);
    const froms = normalizeEndpointPipeIds(conn.from);
    const tos = normalizeEndpointPipeIds(conn.to);

    // 빈 배열 검증
    if (froms.length === 0) {
      issues.push({ path: `connections[${i}].from`, severity: "warning", message: "from 배열이 비어있음" });
    }
    if (tos.length === 0) {
      issues.push({ path: `connections[${i}].to`, severity: "warning", message: "to 배열이 비어있음" });
    }

    fromValues.forEach((value, index) => {
      validateConnectionEndpoint(value, `connections[${i}].from`, Array.isArray(conn.from), index, pipeIds, pipeMap, issues);
    });
    toValues.forEach((value, index) => {
      validateConnectionEndpoint(value, `connections[${i}].to`, Array.isArray(conn.to), index, pipeIds, pipeMap, issues);
    });

    // fan-out인데 to가 단일
    if (conn.kind === "fan-out" && tos.length <= 1) {
      issues.push({ path: `connections[${i}]`, severity: "warning", message: "fan-out인데 to가 단일 (next로 충분)" });
    }

    // join인데 from이 단일
    if (conn.kind === "join" && froms.length <= 1) {
      issues.push({ path: `connections[${i}]`, severity: "warning", message: "join인데 from이 단일 (next로 충분)" });
    }
  }

  // 도달 가능성 검증
  const reachable = new Set<string>();
  function walkReachable(pipeId: string): void {
    if (reachable.has(pipeId)) return;
    reachable.add(pipeId);
    for (const conn of graph.connections) {
      const froms = normalizeEndpointPipeIds(conn.from);
      if (froms.includes(pipeId)) {
        const tos = normalizeEndpointPipeIds(conn.to);
        for (const t of tos) walkReachable(t);
      }
    }
  }
  walkReachable(graph.entryPipeId);

  for (const pipe of graph.pipes) {
    if (!reachable.has(pipe.pipeId)) {
      issues.push({ path: `pipes[${pipe.pipeId}]`, severity: "warning", message: "진입점에서 도달 불가능" });
    }
  }

  return issues;
}

function validateConnectionEndpoint(
  endpoint: string | PortRef,
  path: string,
  isArray: boolean,
  index: number,
  pipeIds: Set<string>,
  pipeMap: Map<string, PipeSpec>,
  issues: ValidationIssue[],
): void {
  if (!isPortRef(endpoint)) {
    if (!pipeIds.has(endpoint)) {
      issues.push({ path: endpointValuePath(path, isArray, index), severity: "error", message: `pipeId "${endpoint}" 없음` });
    }
    return;
  }

  if (!pipeIds.has(endpoint.pipeId)) {
    issues.push({
      path: endpointValuePath(path, isArray, index, "pipeId"),
      severity: "error",
      message: `pipeId "${endpoint.pipeId}" 없음`,
    });
    return;
  }

  if (endpoint.portId == null) return;

  const pipe = pipeMap.get(endpoint.pipeId);
  const hasPort = pipe?.ports?.some(port => port.portId === endpoint.portId) ?? false;
  if (!hasPort) {
    issues.push({
      path: endpointValuePath(path, isArray, index, "portId"),
      severity: "error",
      message: `pipe "${endpoint.pipeId}"에 portId "${endpoint.portId}" 없음`,
    });
  }
}

function endpointValuePath(
  path: string,
  isArray: boolean,
  index: number,
  field?: keyof PortRef,
): string {
  const base = isArray ? `${path}[${index}]` : path;
  return field ? `${base}.${field}` : base;
}
