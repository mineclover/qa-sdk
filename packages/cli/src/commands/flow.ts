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
  type FlowSchema,
  type GateProfile,
  type FlowInstance,
} from "decision-flow";

// ─── 상태 관리 (세션 내 인메모리) ────────────────────────

const engine = new FlowEngine();
let initialized = false;

function ensureInit() {
  if (initialized) return;
  // 스프린트 파이프라인 스키마 등록
  for (const flow of ALL_SPRINT_FLOWS) {
    engine.registerSchema(flow);
  }
  // coordinate-design (annotated with weights/affects)
  engine.registerSchema(getAnnotatedDesignFlow());
  // autoplan 정책 등록
  for (const policy of AUTOPLAN_POLICIES) {
    engine.registerPolicy(policy);
  }
  initialized = true;
}

// ─── flow list ───────────────────────────────────────────

export function flowList() {
  ensureInit();
  const schemas = engine.listSchemas();

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
    for (const s of engine.listSchemas()) {
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

  const inst = engine.startFlow(schemaId, context);
  console.log(`\n✓ 플로우 시작: ${inst.id}`);
  console.log(`  스키마: ${inst.schemaId} (${inst.schemaVersion})`);
  console.log(`  상태: ${inst.status}`);

  const currentGate = engine.getCurrentGate(inst.id);
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

  let evidence: any[] = [];
  if (values.evidence) {
    try { evidence = JSON.parse(values.evidence); } catch {
      console.error("--evidence는 유효한 JSON 배열이어야 합니다");
      return;
    }
  }

  const confidence = values.confidence ? parseFloat(values.confidence) : undefined;

  try {
    const result = engine.selectBranch(instanceId, branchId, evidence, { confidence });
    const schema = engine.getSchema(result.schemaId)!;

    console.log(`\n✓ 선택: ${branchId}`);
    console.log(`  상태: ${result.status}`);
    console.log(`  선택 수: ${result.selections.length}/${schema.gates.length}`);

    if (result.status === "completed") {
      printCompletion(schema, result);
    } else {
      const nextGate = engine.getCurrentGate(instanceId);
      if (nextGate) printCurrentGate(nextGate);
    }
  } catch (e: any) {
    console.error(`선택 실패: ${e.message}`);
  }
}

// ─── flow status ─────────────────────────────────────────

export function flowStatus(argv: string[]) {
  ensureInit();
  const instanceId = argv[0] ?? findActiveInstance();

  if (!instanceId) {
    // 전체 인스턴스 목록
    const all = engine.listInstances();
    if (all.length === 0) {
      console.log("\n활성 플로우 인스턴스 없음. qa-sdk flow start <schema-id>로 시작하세요.");
      return;
    }

    console.log(`\n══ Flow Instances (${all.length}) ══\n`);
    console.log(`${"ID".padEnd(40)} ${"스키마".padEnd(20)} ${"상태".padEnd(12)} 선택`);
    console.log("─".repeat(80));
    for (const inst of all) {
      const schema = engine.getSchema(inst.schemaId);
      const total = schema?.gates.length ?? "?";
      console.log(
        `${inst.id.padEnd(40)} ${inst.schemaId.padEnd(20)} ${inst.status.padEnd(12)} ${inst.selections.length}/${total}`,
      );
    }
    return;
  }

  const inst = engine.getInstance(instanceId);
  if (!inst) {
    console.error(`인스턴스를 찾을 수 없음: ${instanceId}`);
    return;
  }

  const schema = engine.getSchema(inst.schemaId);
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

  const currentGate = engine.getCurrentGate(instanceId);
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

  const inst = engine.getInstance(instanceId);
  if (!inst) {
    console.error(`인스턴스를 찾을 수 없음: ${instanceId}`);
    return;
  }

  const schema = engine.getSchema(inst.schemaId);
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
    : engine.getSchema(schemaId);

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

// ─── 내부 유틸 ───────────────────────────────────────────

function findActiveInstance(): string | undefined {
  const active = engine.listInstances({ status: "active" });
  return active.length > 0 ? active[active.length - 1].id : undefined;
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
