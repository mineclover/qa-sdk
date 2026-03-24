/**
 * qa-sdk flow — 의사결정 분기 관리 CLI
 *
 * 명령:
 *   flow list                    스키마 목록
 *   flow start <schema-id>       플로우 시작
 *   flow select <branch-id>      분기 선택
 *   flow status [instance-id]    현재 진행 상태
 *   flow trace <instance-id>     코어 결정 추적
 *   flow analyze <schema-id>     구조적 분석 (코어 gate, 인과 그래프, 영향)
 */

import { parseArgs } from "node:util";
import { compareTimestamps, normalizeTimestamp } from "@qa-sdk/core";
import {
  FlowEngine,
  ALL_SPRINT_FLOWS,
  SPRINT_FLOW_REGISTRY,
  AUTOPLAN_POLICIES,
  COORDINATE_DESIGN_FLOW,
  getAnnotatedDesignFlow,
  analyzeGateStructure,
  identifyCoreGates,
  extractCausalGraph,
  analyzeImpact,
  traceCorePath,
  buildFlowCompletionContext,
  serializeObservedEvent,
  encodeDecisionEvent,
  detectPatterns,
  diffInstances,
  gateDistribution,
  compareTimeRanges,
  createComparisonReport,
  MemoryInstanceStore,
  PolicyCandidateWorkflow,
  type FlowSchema,
  type GateProfile,
  type FlowInstance,
  type Evidence,
  type PolicyCandidateStatus,
  type FlowPolicy,
} from "decision-flow";

// ─── 상태 관리 (세션 내 인메모리) ────────────────────────

interface CandidateInsight {
  readonly schemaId: string;
  readonly frequency: number;
  readonly averageConfidence: number;
}

interface FlowCliState {
  engine: FlowEngine;
  store: MemoryInstanceStore;
  workflow: PolicyCandidateWorkflow;
  candidateInsights: Map<string, CandidateInsight>;
  initialized: boolean;
}

function createFlowCliState(): FlowCliState {
  const store = new MemoryInstanceStore();
  const engine = new FlowEngine({ instanceStore: store });

  return {
    engine,
    store,
    workflow: new PolicyCandidateWorkflow({ engine }),
    candidateInsights: new Map(),
    initialized: false,
  };
}

let state = createFlowCliState();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function ensureInit() {
  if (state.initialized) return;
  // 스프린트 파이프라인 스키마 등록
  for (const flow of ALL_SPRINT_FLOWS) {
    state.engine.registerSchema(flow);
  }
  // coordinate-design (annotated with weights/affects)
  state.engine.registerSchema(getAnnotatedDesignFlow());
  // autoplan 정책 등록
  for (const policy of AUTOPLAN_POLICIES) {
    state.engine.registerPolicy(policy);
  }
  state.initialized = true;
}

export function resetFlowCliStateForTest() {
  state = createFlowCliState();
}

export function getFlowCliStateForTest() {
  ensureInit();
  return state;
}

// ─── flow list ───────────────────────────────────────────

export function flowList() {
  ensureInit();
  const schemas = state.engine.listSchemas();

  console.log(`\n══ Decision Flow Schemas (${schemas.length}) ══\n`);
  console.log(`${"ID".padEnd(25)} ${"이름".padEnd(20)} Gates  Version`);
  console.log("─".repeat(70));

  for (const s of schemas) {
    const gateCount = s.gates.length;
    console.log(`${s.id.padEnd(25)} ${s.name.padEnd(20)} ${String(gateCount).padStart(5)}  ${s.version}`);
  }
  console.log();
}

// ─── flow start <schema-id> ──────────────────────────────

export function flowStart(argv: string[]) {
  ensureInit();
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      context: { type: "string", short: "c" },
    },
    allowPositionals: true,
  });

  const schemaId = positionals[0];
  if (!schemaId) {
    console.error("Usage: qa-sdk flow start <schema-id> [--context '{...}']");
    console.log("\n사용 가능한 스키마:");
    for (const s of state.engine.listSchemas()) {
      console.log(`  ${s.id}`);
    }
    return;
  }

  let context: Record<string, unknown> = {};
  if (values.context) {
    try { context = JSON.parse(values.context); } catch {
      console.error("--context는 유효한 JSON이어야 합니다");
      return;
    }
  }

  const inst = state.engine.startFlow(schemaId, context);
  console.log(`\n✓ 플로우 시작: ${inst.id}`);
  console.log(`  스키마: ${inst.schemaId} (${inst.schemaVersion})`);
  console.log(`  상태: ${inst.status}`);

  const currentGate = state.engine.getCurrentGate(inst.id);
  if (currentGate) {
    printCurrentGate(currentGate);
  }

  console.log(`\n  다음: qa-sdk flow select <branch-id>`);
}

// ─── flow select <branch-id> ─────────────────────────────

export function flowSelect(argv: string[]) {
  ensureInit();
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      instance: { type: "string", short: "i" },
      evidence: { type: "string", short: "e" },
      confidence: { type: "string" },
    },
    allowPositionals: true,
  });

  const branchId = positionals[0];
  if (!branchId) {
    console.error("Usage: qa-sdk flow select <branch-id> [--instance <id>] [--evidence '{...}'] [--confidence 0.8]");
    return;
  }

  // 활성 인스턴스 찾기
  const instanceId = values.instance ?? findActiveInstance();
  if (!instanceId) {
    console.error("활성 플로우 인스턴스가 없습니다. qa-sdk flow start <schema-id>로 시작하세요.");
    return;
  }

  let evidence: Evidence[] = [];
  if (values.evidence) {
    try {
      const parsed = JSON.parse(values.evidence) as unknown;
      if (!Array.isArray(parsed)) throw new Error("not-array");
      evidence = parsed as Evidence[];
    } catch {
      console.error("--evidence는 유효한 JSON 배열이어야 합니다");
      return;
    }
  }

  const confidence = values.confidence ? parseFloat(values.confidence) : undefined;

  try {
    const result = state.engine.selectBranch(instanceId, branchId, evidence, { confidence });
    const schema = state.engine.getSchema(result.schemaId)!;

    console.log(`\n✓ 선택: ${branchId}`);
    console.log(`  상태: ${result.status}`);
    console.log(`  선택 수: ${result.selections.length}/${schema.gates.length}`);

    if (result.status === "completed") {
      printCompletion(schema, result);
    } else {
      const nextGate = state.engine.getCurrentGate(instanceId);
      if (nextGate) printCurrentGate(nextGate);
    }
  } catch (e: unknown) {
    console.error(`선택 실패: ${errorMessage(e)}`);
  }
}

// ─── flow status ─────────────────────────────────────────

export function flowStatus(argv: string[]) {
  ensureInit();
  const instanceId = argv[0] ?? findActiveInstance();

  if (!instanceId) {
    // 전체 인스턴스 목록
    const all = state.engine.listInstances();
    if (all.length === 0) {
      console.log("\n활성 플로우 인스턴스 없음. qa-sdk flow start <schema-id>로 시작하세요.");
      return;
    }

    console.log(`\n══ Flow Instances (${all.length}) ══\n`);
    console.log(`${"ID".padEnd(40)} ${"스키마".padEnd(20)} ${"상태".padEnd(12)} 선택`);
    console.log("─".repeat(80));
    for (const inst of all) {
      const schema = state.engine.getSchema(inst.schemaId);
      const total = schema?.gates.length ?? "?";
      console.log(
        `${inst.id.padEnd(40)} ${inst.schemaId.padEnd(20)} ${inst.status.padEnd(12)} ${inst.selections.length}/${total}`,
      );
    }
    return;
  }

  const inst = state.engine.getInstance(instanceId);
  if (!inst) {
    console.error(`인스턴스를 찾을 수 없음: ${instanceId}`);
    return;
  }

  const schema = state.engine.getSchema(inst.schemaId);
  console.log(`\n══ Flow: ${inst.id} ══`);
  console.log(`  스키마: ${inst.schemaId} (${inst.schemaVersion})`);
  console.log(`  상태: ${inst.status}`);
  console.log(`  시작: ${inst.startedAt}`);
  if (inst.completedAt) console.log(`  완료: ${inst.completedAt}`);
  if (inst.coordinateAddress !== undefined) console.log(`  좌표: ${inst.schemaId}:${inst.schemaVersion}:${inst.coordinateAddress}`);

  console.log(`\n  선택 이력 (${inst.selections.length}/${schema?.gates.length ?? "?"}):`);
  for (const sel of inst.selections) {
    const gate = schema?.gates.find((g) => g.id === sel.gateId);
    const w = gate?.weight ?? "tactical";
    const marker = w === "core" ? "★" : w === "structural" ? "◆" : "·";
    console.log(`    ${marker} ${sel.gateId.padEnd(20)} = ${sel.branchId.padEnd(15)} (confidence: ${sel.confidence.toFixed(2)})`);
  }

  const currentGate = state.engine.getCurrentGate(instanceId);
  if (currentGate && inst.status === "active") {
    console.log();
    printCurrentGate(currentGate);
  }
}

// ─── flow trace <instance-id> ────────────────────────────

export function flowTrace(argv: string[]) {
  ensureInit();
  const instanceId = argv[0] ?? findActiveInstance();

  if (!instanceId) {
    console.error("Usage: qa-sdk flow trace <instance-id>");
    return;
  }

  const inst = state.engine.getInstance(instanceId);
  if (!inst) {
    console.error(`인스턴스를 찾을 수 없음: ${instanceId}`);
    return;
  }

  const schema = state.engine.getSchema(inst.schemaId);
  if (!schema) {
    console.error(`스키마를 찾을 수 없음: ${inst.schemaId}`);
    return;
  }

  // annotated 스키마 사용 (coordinate-design인 경우)
  const annotated = inst.schemaId === "coordinate-design" ? getAnnotatedDesignFlow() : schema;
  const trace = traceCorePath(annotated, inst);

  console.log(`\n══ Core Decision Trace: ${inst.id} ══\n`);

  if (trace.pivotPoints.length === 0) {
    console.log("  코어 결정 없음 (모든 gate가 tactical)");
    return;
  }

  console.log("  인과 체인:");
  console.log(`  ${trace.causalChain.join(" → ")}\n`);

  console.log("  Pivot Points:");
  for (const pp of trace.pivotPoints) {
    console.log(`    ★ ${pp.gateId} = ${pp.branchId}`);
    console.log(`      배제된 대안: ${pp.excludedBranches}개`);
    console.log(`      후속 영향: ${pp.downstreamImpact}개 gate`);
    console.log(`      ${pp.reason}`);
    console.log();
  }
}

// ─── flow analyze <schema-id> ────────────────────────────

export function flowAnalyze(argv: string[]) {
  ensureInit();
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      impact: { type: "string" },  // 특정 gate의 영향 분석
    },
    allowPositionals: true,
  });

  const schemaId = positionals[0];
  if (!schemaId) {
    console.error("Usage: qa-sdk flow analyze <schema-id> [--impact <gate-id>]");
    return;
  }

  // annotated 스키마 우선
  const schema = schemaId === "coordinate-design"
    ? getAnnotatedDesignFlow()
    : state.engine.getSchema(schemaId);

  if (!schema) {
    console.error(`스키마를 찾을 수 없음: ${schemaId}`);
    return;
  }

  // 구조적 프로파일
  const profiles = analyzeGateStructure(schema);
  const coreGates = identifyCoreGates(profiles);

  console.log(`\n══ Structural Analysis: ${schemaId} ══\n`);

  console.log(`${"Gate".padEnd(25)} ${"Weight".padEnd(12)} ${"Direct".padStart(7)} ${"Transit".padStart(8)} ${"Deps".padStart(5)} ${"Score".padStart(6)}`);
  console.log("─".repeat(70));
  for (const p of profiles) {
    const marker = p.weight === "core" ? "★" : p.weight === "structural" ? "◆" : " ";
    console.log(
      `${marker} ${p.gateId.padEnd(24)} ${p.weight.padEnd(12)} ${String(p.directImpact).padStart(6)} ${String(p.transitiveImpact).padStart(7)} ${String(p.dependents).padStart(4)} ${String(p.coreScore).padStart(5)}`,
    );
  }

  // 코어 게이트 요약
  if (coreGates.length > 0) {
    console.log(`\n  Core Gates (${coreGates.length}):`);
    for (const c of coreGates) {
      console.log(`    ★ ${c.gateId} — 변경 시 ${c.transitiveImpact}개 gate에 전이적 영향`);
    }
  }

  // 인과 그래프
  const graph = extractCausalGraph(schema);
  if (graph.edges.length > 0) {
    console.log(`\n  Causal Graph (${graph.edges.length} edges):`);
    for (const e of graph.edges) {
      const arrow = e.kind === "invalidates" ? "══▶" : e.kind === "constrains" ? "──▶" : "··▶";
      console.log(`    ${e.from} ${arrow} ${e.to} (${e.kind})`);
    }
    if (graph.roots.length > 0) {
      console.log(`\n  루트 결정 (의존 없음): ${graph.roots.join(", ")}`);
    }
  }

  // --impact: 특정 gate 영향 분석
  if (values.impact) {
    const impact = analyzeImpact(schema, values.impact);
    console.log(`\n  ══ Impact Analysis: ${values.impact} 변경 시 ══`);
    console.log(`    직접 무효화: ${impact.directlyInvalidated.length > 0 ? impact.directlyInvalidated.join(", ") : "(없음)"}`);
    console.log(`    전이적 무효화: ${impact.transitivelyInvalidated.length > 0 ? impact.transitivelyInvalidated.join(", ") : "(없음)"}`);
    console.log(`    영향 분포: core=${impact.impactedWeights.core}, structural=${impact.impactedWeights.structural}, tactical=${impact.impactedWeights.tactical}`);
    if (impact.invalidatesCore) {
      console.log(`    ⚠ 코어 gate가 무효화됨 — 전체 재설계 필요`);
    }
  }

  console.log();
}

// ─── flow compare ───────────────────────────────────────

export function flowCompare(argv: string[]) {
  ensureInit();
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      gate: { type: "string" },
      schema: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      "core-only": { type: "boolean" },
    },
    allowPositionals: true,
  });

  if (positionals.length >= 2) {
    printPairwiseComparison(positionals[0]!, positionals[1]!);
    return;
  }

  if (values.from || values.to) {
    if (!values.from || !values.to || !values.schema) {
      console.error("Usage: qa-sdk flow compare --from <date> --to <date> --schema <schema-id> [--core-only]");
      return;
    }
    printTemporalComparison(values.schema, values.from, values.to, values["core-only"] ?? false);
    return;
  }

  if (values.gate || values.schema) {
    if (!values.gate || !values.schema) {
      console.error("Usage: qa-sdk flow compare --gate <gate-id> --schema <schema-id>");
      return;
    }
    printGateDistribution(values.schema, values.gate);
    return;
  }

  console.error("Usage:");
  console.error("  qa-sdk flow compare <instance-a> <instance-b>");
  console.error("  qa-sdk flow compare --gate <gate-id> --schema <schema-id>");
  console.error("  qa-sdk flow compare --from <date> --to <date> --schema <schema-id> [--core-only]");
}

// ─── flow policy candidates ─────────────────────────────

export function flowPolicyCandidates(argv: string[]) {
  ensureInit();
  const { values } = parseArgs({
    args: argv,
    options: {
      status: { type: "string" },
    },
    allowPositionals: true,
  });

  const status = normalizeCandidateStatus(values.status);
  const candidates = state.workflow.listCandidates(status ?? "candidate");

  if (candidates.length === 0) {
    console.log("\n정책 후보 없음. qa-sdk flow policy learn <schema-id>로 후보를 생성하세요.");
    return;
  }

  console.log(`\n══ Policy Candidates (${candidates.length}) ══\n`);
  console.log(`${"ID".padEnd(36)} ${"Flow".padEnd(20)} ${"Action".padEnd(28)} ${"빈도".padStart(4)} ${"Conf".padStart(6)} 상태`);
  console.log("─".repeat(110));

  for (const candidate of candidates) {
    const insight = resolveCandidateInsight(candidate.id, candidate.rationale, candidate.flowId);
    const action = `${candidate.action.gateId}:${candidate.action.branchId}`;
    console.log(
      `${candidate.id.padEnd(36)} ${candidate.flowId.padEnd(20)} ${action.padEnd(28)} ${String(insight?.frequency ?? "-").padStart(4)} ${formatConfidence(insight?.averageConfidence).padStart(6)} ${candidate.status}`,
    );
  }

  console.log();
}

// ─── flow policy approve <id> ───────────────────────────

export function flowPolicyApprove(argv: string[]) {
  ensureInit();
  const candidateId = argv[0];
  if (!candidateId) {
    console.error("Usage: qa-sdk flow policy approve <id>");
    return;
  }

  try {
    const policy = state.workflow.approveCandidate(candidateId);
    console.log(`\n✓ 정책 승인 + 등록: ${policy.id}`);
    console.log(`  flow: ${policy.flowId}`);
    console.log(`  action: ${policy.action.gateId} -> ${policy.action.branchId}`);
    console.log(`  priority: ${policy.priority}`);
  } catch (error) {
    console.error(`정책 승인 실패: ${errorMessage(error)}`);
  }
}

// ─── flow policy reject <id> ────────────────────────────

export function flowPolicyReject(argv: string[]) {
  ensureInit();
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      reason: { type: "string" },
    },
    allowPositionals: true,
  });

  const candidateId = positionals[0];
  if (!candidateId) {
    console.error("Usage: qa-sdk flow policy reject <id> [--reason '...']");
    return;
  }

  try {
    const rejected = state.workflow.rejectCandidate(candidateId, values.reason ?? "CLI에서 거부");
    console.log(`\n✓ 정책 후보 거부: ${rejected.id}`);
    console.log(`  reason: ${rejected.reviewReason ?? "-"}`);
  } catch (error) {
    console.error(`정책 거부 실패: ${errorMessage(error)}`);
  }
}

// ─── flow policy list ───────────────────────────────────

export function flowPolicyList() {
  ensureInit();
  const policies = listRegisteredPolicies();

  if (policies.length === 0) {
    console.log("\n등록된 정책 없음.");
    return;
  }

  console.log(`\n══ Registered Policies (${policies.length}) ══\n`);
  console.log(`${"ID".padEnd(36)} ${"Flow".padEnd(20)} ${"Action".padEnd(28)} ${"Prio".padStart(4)} 조건`);
  console.log("─".repeat(118));

  for (const policy of policies) {
    console.log(
      `${policy.id.padEnd(36)} ${policy.flowId.padEnd(20)} ${`${policy.action.gateId}:${policy.action.branchId}`.padEnd(28)} ${String(policy.priority).padStart(4)} ${policy.conditions.length}`,
    );
  }

  console.log();
}

// ─── flow policy learn <schema-id> ──────────────────────

export function flowPolicyLearn(argv: string[]) {
  ensureInit();
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      "min-frequency": { type: "string" },
      "min-confidence": { type: "string" },
    },
    allowPositionals: true,
  });

  const schemaId = positionals[0];
  if (!schemaId) {
    console.error("Usage: qa-sdk flow policy learn <schema-id> [--min-frequency N] [--min-confidence 0.8]");
    return;
  }

  if (!state.engine.getSchema(schemaId)) {
    console.error(`스키마를 찾을 수 없음: ${schemaId}`);
    return;
  }

  const minFrequency = parseOptionalInteger(values["min-frequency"], "--min-frequency");
  if (minFrequency === null) {
    return;
  }
  const minConfidence = parseOptionalConfidence(values["min-confidence"], "--min-confidence");
  if (minConfidence === null) {
    return;
  }

  const patterns = detectPatterns(state.store, schemaId, {
    minFrequency: minFrequency ?? undefined,
  });
  const proposed = state.workflow.proposeCandidates(patterns, {
    minFrequency: minFrequency ?? undefined,
    minAverageConfidence: minConfidence ?? undefined,
    existingPolicies: state.engine.getPolicies(schemaId),
  });

  for (const candidate of proposed) {
    const insight = extractCandidateInsight(candidate.rationale, schemaId);
    if (insight) {
      state.candidateInsights.set(candidate.id, insight);
    }
  }

  console.log(`\n학습 완료: ${schemaId}`);
  console.log(`  감지된 패턴: ${patterns.length}`);
  console.log(`  생성/유지된 후보: ${proposed.length}`);
  console.log(`  등록된 정책: ${state.engine.getPolicies(schemaId).length}`);

  if (proposed.length > 0) {
    console.log("\n  후보:");
    for (const candidate of proposed) {
      const insight = resolveCandidateInsight(candidate.id, candidate.rationale, schemaId);
      console.log(
        `    - ${candidate.id} | ${candidate.action.gateId}:${candidate.action.branchId} | 빈도 ${insight?.frequency ?? "-"} | confidence ${formatConfidence(insight?.averageConfidence)}`,
      );
    }
  }

  console.log();
}

// ─── 내부 유틸 ───────────────────────────────────────────

function findActiveInstance(): string | undefined {
  const active = state.engine.listInstances({ status: "active" });
  return active.length > 0 ? active[active.length - 1].id : undefined;
}

function listRegisteredPolicies(): FlowPolicy[] {
  const deduped = new Map<string, FlowPolicy>();

  for (const schema of state.engine.listSchemas()) {
    for (const policy of state.engine.getPolicies(schema.id)) {
      if (!deduped.has(policy.id)) {
        deduped.set(policy.id, policy);
      }
    }
  }

  return [...deduped.values()].sort((a, b) =>
    a.flowId.localeCompare(b.flowId)
    || b.priority - a.priority
    || a.id.localeCompare(b.id),
  );
}

function normalizeCandidateStatus(value: string | undefined): PolicyCandidateStatus | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "candidate" || value === "approved" || value === "rejected" || value === "modified") {
    return value;
  }
  console.error(`알 수 없는 candidate status: ${value}`);
  return undefined;
}

function resolveCandidateInsight(
  candidateId: string,
  rationale: string,
  schemaId: string,
): CandidateInsight | undefined {
  const cached = state.candidateInsights.get(candidateId);
  if (cached) {
    return cached;
  }

  const parsed = extractCandidateInsight(rationale, schemaId);
  if (parsed) {
    state.candidateInsights.set(candidateId, parsed);
  }
  return parsed;
}

function extractCandidateInsight(
  rationale: string | undefined,
  schemaId: string,
): CandidateInsight | undefined {
  if (!rationale) {
    return undefined;
  }

  const match = rationale.match(/(\d+)회 반복, 평균 confidence (\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }

  return {
    schemaId,
    frequency: Number.parseInt(match[1]!, 10),
    averageConfidence: Number.parseFloat(match[2]!),
  };
}

function printPairwiseComparison(instanceAId: string, instanceBId: string) {
  const instanceA = state.engine.getInstance(instanceAId);
  const instanceB = state.engine.getInstance(instanceBId);

  if (!instanceA || !instanceB) {
    console.error(`인스턴스를 찾을 수 없음: ${!instanceA ? instanceAId : instanceBId}`);
    return;
  }

  const schema = instanceA.schemaVersion === instanceB.schemaVersion
    ? resolveComparisonSchema(instanceA.schemaId)
    : undefined;
  if (instanceA.schemaVersion !== instanceB.schemaVersion) {
    console.log(`\n⚠ schemaVersion 불일치: ${instanceA.schemaVersion} vs ${instanceB.schemaVersion}`);
    console.log("  공통 선택 이력 기준으로 비교한다.");
  }

  try {
    const diff = diffInstances(instanceA, instanceB, schema);
    const report = createComparisonReport({ pairwiseDiff: diff });

    console.log(`\n══ Flow Pair Compare: ${instanceAId} vs ${instanceBId} ══\n`);
    console.log(`  스키마: ${diff.schemaId}`);
    if (diff.divergencePoint) {
      console.log(
        `  첫 분기점: ${formatCoreMarker(diff.divergencePoint.status === "diverge" && diff.divergencePoint.emphasis === "core")} ${diff.divergencePoint.gateId} (${diff.divergencePoint.branchA ?? "-"} vs ${diff.divergencePoint.branchB ?? "-"})`,
      );
    } else {
      console.log("  첫 분기점: 없음");
    }

    console.log(`\n${"Gate".padEnd(22)} ${"상태".padEnd(8)} ${"A".padEnd(18)} B`);
    console.log("─".repeat(76));
    for (const gateDiff of diff.gateDiffs) {
      const marker = gateDiff.status === "diverge" && gateDiff.emphasis === "core" ? "★" : " ";
      const status = gateDiff.status === "match" ? "match" : "diff";
      console.log(
        `${marker} ${gateDiff.gateId.padEnd(20)} ${status.padEnd(8)} ${(gateDiff.branchA ?? "-").padEnd(18)} ${gateDiff.branchB ?? "-"}`,
      );
    }

    const reasons = report.whyDifferent;
    if (reasons.length > 0) {
      console.log("\n  왜 다른가:");
      for (const reason of reasons) {
        console.log(`    ${reason.emphasis === "core" ? "★" : "-"} ${reason.summary}`);
      }
    }
    console.log();
  } catch (error) {
    console.error(`비교 실패: ${errorMessage(error)}`);
  }
}

function printGateDistribution(schemaId: string, gateId: string) {
  const schema = resolveComparisonSchema(schemaId);
  if (!schema) {
    console.error(`스키마를 찾을 수 없음: ${schemaId}`);
    return;
  }

  const gate = schema.gates.find((candidate) => candidate.id === gateId);
  if (!gate) {
    console.error(`gate를 찾을 수 없음: ${gateId}`);
    return;
  }

  try {
    const distribution = gateDistribution(state.store, schemaId, gateId);
    const report = createComparisonReport({ distributions: [distribution] });

    console.log(`\n══ Flow Gate Compare: ${formatGateMarker(gate.weight)} ${gateId} ══\n`);
    console.log(`  스키마: ${schemaId}`);
    console.log(`  표본 수: ${distribution.totalSelections}`);
    if (distribution.totalSelections < 5) {
      console.log("  ⚠ 표본이 5건 미만이라 분포 해석이 불충분할 수 있다.");
    }

    if (distribution.branches.length === 0) {
      console.log("\n  완료된 선택 이력이 없다.\n");
      return;
    }

    console.log(`\n${"Branch".padEnd(20)} ${"Count".padStart(5)} ${"Ratio".padStart(7)} ${"Conf".padStart(7)}`);
    console.log("─".repeat(52));
    for (const branch of distribution.branches) {
      console.log(
        `${branch.branchId.padEnd(20)} ${String(branch.count).padStart(5)} ${formatPercent(branch.ratio).padStart(7)} ${formatConfidence(branch.averageConfidence).padStart(7)}${branch.isDominant ? "  dominant" : ""}`,
      );
    }

    const insight = report.distributionInsights[0];
    if (insight) {
      console.log(`\n  요약: ${insight.summary}`);
    }

    if (distribution.evidenceKindCorrelations.length > 0) {
      console.log("\n  Evidence Correlation:");
      for (const correlation of distribution.evidenceKindCorrelations) {
        const topBranch = correlation.branches[0];
        const branchHint = topBranch
          ? `${topBranch.branchId} ${formatPercent(topBranch.ratio)}`
          : "-";
        console.log(
          `    - ${correlation.evidenceKind}: ${correlation.selectionCount}건 (${formatPercent(correlation.selectionRatio)}), 대표 branch ${branchHint}`,
        );
      }
    }
    console.log();
  } catch (error) {
    console.error(`비교 실패: ${errorMessage(error)}`);
  }
}

function printTemporalComparison(
  schemaId: string,
  fromInput: string,
  toInput: string,
  coreOnly: boolean,
) {
  const schema = resolveComparisonSchema(schemaId);
  if (!schema) {
    console.error(`스키마를 찾을 수 없음: ${schemaId}`);
    return;
  }

  const currentRange = parseTimeRange(fromInput, toInput);
  if (!currentRange) {
    return;
  }
  const previousRange = shiftToPreviousRange(currentRange.from, currentRange.to);

  try {
    const comparison = compareTimeRanges(
      state.store,
      schemaId,
      previousRange,
      currentRange,
      { schema, coreOnly },
    );
    const report = createComparisonReport({ temporalShifts: [comparison] });

    console.log(`\n══ Flow Temporal Compare: ${schemaId} ══\n`);
    console.log(`  기간 A: ${previousRange.from} ~ ${previousRange.to}`);
    console.log(`  기간 B: ${currentRange.from} ~ ${currentRange.to}`);
    console.log(`  비교 gate: ${comparison.comparedGateIds.length}개${coreOnly ? " (core only)" : ""}`);

    console.log(`\n${"Gate".padEnd(22)} ${"Shift".padStart(7)} ${"A→B 우세 branch".padEnd(24)} 비고`);
    console.log("─".repeat(82));
    for (const gateShift of comparison.gateShifts) {
      const marker = gateShift.weight === "core" && gateShift.totalShiftPercentage > 0 ? "★" : " ";
      const dominant = `${gateShift.dominantBranchA ?? "-"} → ${gateShift.dominantBranchB ?? "-"}`;
      console.log(
        `${marker} ${gateShift.gateId.padEnd(20)} ${`${gateShift.totalShiftPercentage}%`.padStart(7)} ${dominant.padEnd(24)} ${gateShift.branches.length > 0 ? "branch shift 있음" : "-"}`,
      );
    }

    if (report.temporalInsights.length > 0) {
      console.log("\n  변화 요약:");
      for (const insight of report.temporalInsights) {
        const isCore = comparison.coreGateIds.includes(insight.gateId);
        console.log(`    ${isCore ? "★" : "-"} ${insight.summary}`);
      }
    }

    if (comparison.emergedPaths.length > 0) {
      console.log("\n  새로 등장한 경로:");
      for (const path of comparison.emergedPaths) {
        console.log(`    - ${formatPathSignature(path.signature)} (${path.countB}건)`);
      }
    }

    if (comparison.disappearedPaths.length > 0) {
      console.log("\n  사라진 경로:");
      for (const path of comparison.disappearedPaths) {
        console.log(`    - ${formatPathSignature(path.signature)} (${path.countA}건)`);
      }
    }
    console.log();
  } catch (error) {
    console.error(`비교 실패: ${errorMessage(error)}`);
  }
}

function resolveComparisonSchema(schemaId: string): FlowSchema | undefined {
  if (schemaId === "coordinate-design") {
    return getAnnotatedDesignFlow();
  }
  return state.engine.getSchema(schemaId);
}

function parseTimeRange(fromInput: string, toInput: string): { from: string; to: string } | undefined {
  const from = normalizeTimestamp(fromInput);
  const to = normalizeTimestamp(toInput);
  if (Number.isNaN(new Date(from).getTime()) || Number.isNaN(new Date(to).getTime())) {
    console.error("--from/--to는 유효한 ISO-8601 날짜여야 합니다.");
    return undefined;
  }
  if (compareTimestamps(from, to) > 0) {
    console.error("--from은 --to보다 앞서야 합니다.");
    return undefined;
  }
  return { from, to };
}

function shiftToPreviousRange(from: string, to: string): { from: string; to: string } {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const spanMs = toMs - fromMs + 1;
  return {
    from: new Date(fromMs - spanMs).toISOString(),
    to: new Date(fromMs - 1).toISOString(),
  };
}

function formatGateMarker(weight: FlowSchema["gates"][number]["weight"]): string {
  return weight === "core" ? "★" : weight === "structural" ? "◆" : "·";
}

function formatCoreMarker(isCore: boolean): string {
  return isCore ? "★" : "·";
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPathSignature(signature: string): string {
  return signature.split("|").join(" → ");
}

function formatConfidence(value: number | undefined): string {
  return value === undefined ? "-" : value.toFixed(2);
}

function parseOptionalInteger(value: string | undefined, flagName: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`${flagName}는 1 이상의 정수여야 합니다.`);
    return null;
  }
  return parsed;
}

function parseOptionalConfidence(value: string | undefined, flagName: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    console.error(`${flagName}는 0~1 숫자여야 합니다.`);
    return null;
  }
  return parsed;
}

function printCurrentGate(gate: { id: string; name: string; phase: string; branches?: readonly { id: string; label: string }[]; weight?: string }) {
  const w = gate.weight ?? "tactical";
  const marker = w === "core" ? "★" : w === "structural" ? "◆" : "·";
  console.log(`\n  ${marker} 현재 gate: ${gate.id} (${gate.name}) [${gate.phase}]`);
  if (gate.branches) {
    console.log("  선택지:");
    for (const b of gate.branches) {
      console.log(`    - ${b.id.padEnd(20)} ${b.label}`);
    }
  }
}

function printCompletion(schema: FlowSchema, inst: FlowInstance) {
  console.log(`\n  ✓ 플로우 완료`);
  if (inst.coordinateAddress !== undefined) {
    console.log(`  좌표: ${inst.schemaId}:${inst.schemaVersion}:${inst.coordinateAddress}`);
  }

  // address_context 생성
  try {
    const ctx = buildFlowCompletionContext(schema, inst);
    if (Object.keys(ctx).length > 0) {
      console.log(`  address_context:`);
      for (const [k, v] of Object.entries(ctx)) {
        console.log(`    ${k}: ${v}`);
      }
    }
  } catch { /* 인코딩 실패 무시 */ }
}
