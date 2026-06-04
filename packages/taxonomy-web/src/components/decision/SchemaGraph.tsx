import type { FlowSchema, GateSchema } from "decision-flow";
import type { GateCycle } from "../../lib/decisionDemo";

/**
 * Gate를 가로로 배치하고 depends_on을 화살표로 표시.
 * multi-gate 전용 — single-gate에서는 단일 박스만 그려도 정보가 적어서 caller가 숨김.
 * cycles 전달 시 사이클을 구성하는 엣지를 빨간 굵게 표시.
 */
export function SchemaGraph({
  schema,
  cycles = [],
}: {
  schema: FlowSchema;
  cycles?: GateCycle[];
}) {
  const layout = computeLayout(schema);
  const cycleEdgeSet = computeCycleEdges(cycles);
  const edges = collectEdges(schema, layout).map((e) => ({
    ...e,
    inCycle: cycleEdgeSet.has(`${e.from.gate.id}>${e.to.gate.id}`),
  }));

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="border rounded bg-white w-full"
      style={{ maxHeight: 300 }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
        </marker>
        <marker
          id="arrow-constrain"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
        <marker
          id="arrow-invalidate"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#737373" />
        </marker>
      </defs>

      {edges.map((e, i) => (
        <EdgeArrow key={i} edge={e} />
      ))}

      {layout.nodes.map((node) => (
        <GateBox key={node.gate.id} node={node} />
      ))}
    </svg>
  );
}

// ─── 레이아웃 계산 ─────────────────────────────────────────

const NODE_W = 140;
const NODE_H = 56;
const GAP_X = 40;
const PADDING = 16;

type NodeLayout = {
  gate: GateSchema;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Layout = {
  nodes: NodeLayout[];
  width: number;
  height: number;
};

function computeLayout(schema: FlowSchema): Layout {
  const nodes: NodeLayout[] = schema.gates.map((gate, i) => ({
    gate,
    x: PADDING + i * (NODE_W + GAP_X),
    y: PADDING,
    w: NODE_W,
    h: NODE_H,
  }));
  const width = PADDING * 2 + nodes.length * NODE_W + (nodes.length - 1) * GAP_X;
  const height = PADDING * 2 + NODE_H;
  return { nodes, width, height };
}

type Edge = {
  from: NodeLayout;
  to: NodeLayout;
  kind: "constrains" | "enables" | "invalidates";
  inCycle?: boolean;
};

/** cycles에서 (a → b) edge key 집합 추출 (self-loop는 `a>a`). */
function computeCycleEdges(cycles: readonly GateCycle[]): Set<string> {
  const set = new Set<string>();
  for (const c of cycles) {
    if (c.nodes.length === 1) {
      set.add(`${c.nodes[0]}>${c.nodes[0]}`);
      continue;
    }
    for (let i = 0; i < c.nodes.length; i++) {
      const from = c.nodes[i];
      const to = c.nodes[(i + 1) % c.nodes.length];
      set.add(`${from}>${to}`);
    }
  }
  return set;
}

function collectEdges(schema: FlowSchema, layout: Layout): Edge[] {
  const byId = new Map(layout.nodes.map((n) => [n.gate.id, n] as const));
  const out: Edge[] = [];
  for (const node of layout.nodes) {
    for (const dep of node.gate.affects ?? []) {
      const target = byId.get(dep.gateId);
      if (!target) continue;
      out.push({ from: node, to: target, kind: dep.kind });
    }
  }
  return out;
}

// ─── 노드 ──────────────────────────────────────────────────

function GateBox({ node }: { node: NodeLayout }) {
  const { gate, x, y, w, h } = node;
  const phaseColor = colorForPhase(gate.phase);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill="white"
        stroke={phaseColor}
        strokeWidth={2}
      />
      <text
        x={x + w / 2}
        y={y + 18}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={11}
        fill="#1e40af"
      >
        {gate.id}
      </text>
      <text
        x={x + w / 2}
        y={y + 34}
        textAnchor="middle"
        fontSize={10}
        fill={phaseColor}
      >
        {gate.phase} · {gate.weight ?? "tactical"}
      </text>
      <text
        x={x + w / 2}
        y={y + 48}
        textAnchor="middle"
        fontSize={10}
        fill="#6b7280"
      >
        {gate.branches?.length ?? 0} opts
        {gate.requiredEvidence && gate.requiredEvidence.length > 0
          ? ` · ${gate.requiredEvidence.length} ev`
          : ""}
      </text>
    </g>
  );
}

function colorForPhase(phase?: string): string {
  switch (phase) {
    case "diverge":
    case "perceive":
      return "#2563eb";
    case "converge":
    case "interpret":
      return "#16a34a";
    case "evaluate":
      return "#ca8a04";
    case "plan":
      return "#7c3aed";
    case "execute":
      return "#0891b2";
    case "reflect":
      return "#be185d";
    default:
      return "#475569";
  }
}

// ─── 엣지 ──────────────────────────────────────────────────

function EdgeArrow({ edge }: { edge: Edge }) {
  const { from, to, kind, inCycle } = edge;
  // from의 affects가 to를 가리킴 — from에서 to로 화살표.
  const x1 = from.x + from.w / 2;
  const x2 = to.x + to.w / 2;
  const y1 = from.y + from.h;
  const y2 = to.y + to.h;
  // 같은 row라면 곡선이 아래로 휘게
  const midY = Math.max(y1, y2) + 24;
  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  const stroke = inCycle ? "#b91c1c" : strokeForKind(kind);
  const marker = inCycle
    ? "url(#arrow-constrain)"
    : kind === "constrains"
      ? "url(#arrow-constrain)"
      : kind === "invalidates"
        ? "url(#arrow-invalidate)"
        : "url(#arrow)";
  const isInvalidate = kind === "invalidates";
  const labelX = (x1 + x2) / 2;
  const labelY = midY + 4;
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={inCycle ? 2.5 : 1.5}
        strokeDasharray={isInvalidate && !inCycle ? "4 3" : undefined}
        markerEnd={marker}
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        fontSize={9}
        fill={stroke}
        fontFamily="monospace"
        fontWeight={inCycle ? "bold" : undefined}
      >
        {inCycle ? `⟲ ${kind}` : kind}
      </text>
    </g>
  );
}

function strokeForKind(kind: Edge["kind"]): string {
  switch (kind) {
    case "constrains":
      return "#dc2626";
    case "enables":
      return "#7c3aed";
    case "invalidates":
      return "#737373";
  }
}
