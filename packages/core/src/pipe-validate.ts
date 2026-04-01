/**
 * PipeSpec / PipeGraph 구조 검증
 */

import type { PipeFlow, PipeSpec, PipeGraph } from "./types/pipe-spec.js";

export interface ValidationIssue {
  path: string;
  severity: "error" | "warning";
  message: string;
}

const KNOWN_FACETS = ["생산", "소비", "정의", "관리", "저장"];

// ── PipeSpec 검증 ─────────────────────────────────────

export function validatePipeSpec(spec: PipeSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!spec.trigger.eventKey) {
    issues.push({ path: "trigger.eventKey", severity: "error", message: "트리거 이벤트 키 누락" });
  }

  validateFlow(spec.flow, "flow", issues, 0);
  return issues;
}

function validateFlow(flow: PipeFlow, path: string, issues: ValidationIssue[], depth: number): void {
  if (depth > 8) {
    issues.push({ path, severity: "warning", message: "흐름 중첩 깊이 > 8" });
  }

  switch (flow.kind) {
    case "step":
      if (flow.facet && !KNOWN_FACETS.includes(flow.facet)) {
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

    case "feedback":
      if (flow.maxIterations == null) {
        issues.push({ path, severity: "warning", message: "feedback.maxIterations 미설정 (무한 루프 위험)" });
      }
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      break;

    case "map":
      validateFlow(flow.itemFlow, `${path}.itemFlow`, issues, depth + 1);
      break;

    case "reduce":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "buffer":
      if (flow.count == null && flow.duration == null) {
        issues.push({ path, severity: "warning", message: "buffer: count와 duration 모두 미설정" });
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
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "throttle":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "debounce":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "split":
      validateFlow(flow.itemFlow, `${path}.itemFlow`, issues, depth + 1);
      break;

    case "enrich":
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
      validateFlow(flow.body, `${path}.body`, issues, depth + 1);
      break;

    case "dedup":
      validateFlow(flow.step, `${path}.step`, issues, depth + 1);
      break;

    case "correlation":
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
    const froms = Array.isArray(conn.from) ? conn.from : [conn.from];
    const tos = Array.isArray(conn.to) ? conn.to : [conn.to];

    for (const f of froms) {
      if (!pipeIds.has(f)) {
        issues.push({ path: `connections[${i}].from`, severity: "error", message: `pipeId "${f}" 없음` });
      }
    }
    for (const t of tos) {
      if (!pipeIds.has(t)) {
        issues.push({ path: `connections[${i}].to`, severity: "error", message: `pipeId "${t}" 없음` });
      }
    }

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
      const froms = Array.isArray(conn.from) ? conn.from : [conn.from];
      if (froms.includes(pipeId)) {
        const tos = Array.isArray(conn.to) ? conn.to : [conn.to];
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
