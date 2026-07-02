import type {
  CompiledLineage,
  DiagnosticSeverity,
  MeasurementReport,
  ProfileDiagnostic,
  ValidationReport,
} from "data-structure-profile";

export type DataStructureLineageSummary = {
  profile: string;
  sources: number;
  structures: number;
  transforms: number;
  facts: number;
  edges: number;
  diagnostics: Record<"errors" | "warnings" | "infos", number>;
  rowMultiplier?: number;
  estimatedFactRowsPerSec?: number;
};

export type DataStructureLineageNode = {
  id: string;
  kind: string;
  label: string;
  taxonomyRef: string;
  x: number;
  y: number;
  diagnostics: ProfileDiagnostic[];
};

export type DataStructureLineageEdge = {
  id: string;
  source: string;
  target: string;
  kind: string;
};

export type DataStructureLineageD3 = {
  profile: string;
  taxonomyRef: string;
  nodes: DataStructureLineageNode[];
  edges: DataStructureLineageEdge[];
  summary: DataStructureLineageSummary;
  measurement?: {
    rowMultiplier: number;
    estimatedFactRowsPerSec: number;
    estimatedOutputBytesPerSec: number;
    estimatedDailyFactRows: number;
  };
};

const NODE_W = 172;
const NODE_H = 76;
const NODE_GAP = 56;
const PAD_X = 48;
const PAD_Y = 48;

export function summarizeDataStructureLineage(
  compiled: CompiledLineage,
  validation?: ValidationReport,
  measurement?: MeasurementReport,
): DataStructureLineageSummary {
  const nodes = compiled.lineage.nodes;

  return {
    profile: compiled.profile,
    sources: nodes.filter((node) => node.kind === "source").length,
    structures: nodes.filter((node) => ["event", "array", "fact"].includes(node.kind)).length,
    transforms: nodes.filter((node) => node.kind === "transform").length,
    facts: nodes.filter((node) => node.kind === "fact").length,
    edges: compiled.lineage.edges.length,
    diagnostics: {
      errors: validation?.summary.errors ?? 0,
      warnings: validation?.summary.warnings ?? 0,
      infos: validation?.summary.infos ?? 0,
    },
    ...(measurement
      ? {
          rowMultiplier: measurement.estimates.rowMultiplier,
          estimatedFactRowsPerSec: measurement.estimates.estimatedFactRowsPerSec,
        }
      : {}),
  };
}

export function dataStructureLineageToD3(
  compiled: CompiledLineage,
  validation?: ValidationReport,
  measurement?: MeasurementReport,
): DataStructureLineageD3 {
  const diagnosticMap = mapDiagnosticsToNodes(compiled, validation);
  const nodes = compiled.lineage.nodes.map((node, index) => ({
    ...node,
    x: PAD_X + index * (NODE_W + NODE_GAP),
    y: PAD_Y,
    diagnostics: diagnosticMap.get(node.id) ?? [],
  }));

  return {
    profile: compiled.profile,
    taxonomyRef: compiled.taxonomyRef,
    nodes,
    edges: compiled.lineage.edges.map((edge) => ({
      id: `${edge.from}->${edge.to}:${edge.kind}`,
      source: edge.from,
      target: edge.to,
      kind: edge.kind,
    })),
    summary: summarizeDataStructureLineage(compiled, validation, measurement),
    ...(measurement
      ? {
          measurement: {
            rowMultiplier: measurement.estimates.rowMultiplier,
            estimatedFactRowsPerSec: measurement.estimates.estimatedFactRowsPerSec,
            estimatedOutputBytesPerSec: measurement.estimates.estimatedOutputBytesPerSec,
            estimatedDailyFactRows: measurement.estimates.estimatedDailyFactRows,
          },
        }
      : {}),
  };
}

export function dataStructureLineageToMermaid(
  compiled: CompiledLineage,
  validation?: ValidationReport,
): string {
  const graph = dataStructureLineageToD3(compiled, validation);
  const lines = ["flowchart LR"];

  for (const node of graph.nodes) {
    const diagnosticLabel = node.diagnostics.length
      ? `\\n${highestSeverity(node.diagnostics)}: ${node.diagnostics.map((diagnostic) => diagnostic.code).join(", ")}`
      : "";
    lines.push(`  ${mermaidId(node.id)}["${escapeMermaid(`${node.label}\\n${node.kind}${diagnosticLabel}`)}"]`);
  }

  for (const edge of graph.edges) {
    lines.push(`  ${mermaidId(edge.source)} -->|${escapeMermaid(edge.kind)}| ${mermaidId(edge.target)}`);
  }

  lines.push("  classDef diagnostic_error fill:#fef2f2,stroke:#dc2626,color:#7f1d1d");
  lines.push("  classDef diagnostic_warning fill:#fff7ed,stroke:#f59e0b,color:#7c2d12");
  lines.push("  classDef diagnostic_info fill:#eff6ff,stroke:#2563eb,color:#1e3a8a");

  for (const node of graph.nodes.filter((node) => node.diagnostics.length > 0)) {
    lines.push(`  class ${mermaidId(node.id)} diagnostic_${highestSeverity(node.diagnostics)}`);
  }

  return `${lines.join("\n")}\n`;
}

export function dataStructureLineageToSvg(
  compiled: CompiledLineage,
  validation?: ValidationReport,
  measurement?: MeasurementReport,
): string {
  const graph = dataStructureLineageToD3(compiled, validation, measurement);
  const width = PAD_X * 2 + graph.nodes.length * NODE_W + Math.max(0, graph.nodes.length - 1) * NODE_GAP;
  const height = 238;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const metric = graph.measurement
    ? `${formatNumber(graph.measurement.estimatedFactRowsPerSec)} facts/sec`
    : "measurement unavailable";

  const edges = graph.edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return "";
    const x1 = source.x + NODE_W;
    const y1 = source.y + NODE_H / 2;
    const x2 = target.x;
    const y2 = target.y + NODE_H / 2;
    return [
      `<line class="edge edge-${escapeAttr(edge.kind)}" data-edge-id="${escapeAttr(edge.id)}"`,
      ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#arrow)" />`,
      `<text class="edge-label" x="${(x1 + x2) / 2}" y="${y1 - 10}">${escapeHtml(edge.kind)}</text>`,
    ].join("");
  }).join("");

  const nodes = graph.nodes.map((node) => {
    const severity = node.diagnostics.length > 0 ? highestSeverity(node.diagnostics) : "none";
    const diagnosticLabel = node.diagnostics.length > 1
      ? `${severity} (${node.diagnostics.length})`
      : severity;
    const diagnostics = node.diagnostics.map((diagnostic) => (
      `<text class="diagnostic diagnostic-${escapeAttr(diagnostic.severity)}" x="${node.x + 14}" y="${node.y + 66}" data-diagnostic-code="${escapeAttr(diagnostic.code)}">${escapeHtml(diagnosticLabel)}</text>`
    )).join("");

    return [
      `<g class="node node-${escapeAttr(node.kind)} diagnostic-${severity}" data-node-id="${escapeAttr(node.id)}">`,
      `<rect x="${node.x}" y="${node.y}" width="${NODE_W}" height="${NODE_H}" rx="8" />`,
      `<text class="node-label" x="${node.x + 14}" y="${node.y + 26}">${escapeHtml(truncateLabel(node.label, 24))}</text>`,
      `<text class="node-kind" x="${node.x + 14}" y="${node.y + 46}">${escapeHtml(node.kind)}</text>`,
      `<title>${escapeHtml(nodeTitle(node))}</title>`,
      node.diagnostics.map((diagnostic) => (
        `<title>${escapeHtml(`${diagnostic.code}: ${diagnostic.message}`)}</title>`
      )).join(""),
      diagnostics,
      "</g>",
    ].join("");
  }).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(compiled.profile)} lineage">`,
    "<defs>",
    '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">',
    '<path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />',
    "</marker>",
    "</defs>",
    "<style>",
    ".edge{stroke:#64748b;stroke-width:2}.edge-label{font:12px system-ui;fill:#64748b;text-anchor:middle}",
    ".node rect{fill:#fff;stroke:#94a3b8;stroke-width:1.5}.node-label{font:600 13px system-ui;fill:#111827}.node-kind{font:12px system-ui;fill:#64748b}",
    ".diagnostic-warning rect{fill:#fff7ed;stroke:#f59e0b}.diagnostic-error rect{fill:#fef2f2;stroke:#dc2626}.diagnostic-info rect{fill:#eff6ff;stroke:#2563eb}",
    ".diagnostic{font:10px system-ui;fill:#92400e}.metric{font:600 13px system-ui;fill:#0f172a}.metric-label{font:12px system-ui;fill:#64748b}",
    "</style>",
    edges,
    nodes,
    `<text class="metric-label" x="${PAD_X}" y="188">estimated throughput</text>`,
    `<text class="metric" x="${PAD_X}" y="208">${escapeHtml(metric)}</text>`,
    "</svg>",
  ].join("");
}

function mapDiagnosticsToNodes(
  compiled: CompiledLineage,
  validation?: ValidationReport,
): Map<string, ProfileDiagnostic[]> {
  const result = new Map<string, ProfileDiagnostic[]>();
  if (!validation) return result;

  for (const diagnostic of validation.diagnostics) {
    const target = compiled.diagnosticTargets[diagnostic.code] ?? diagnostic.target;
    const nodeId = resolveTargetNode(compiled, target);
    if (!nodeId) continue;
    const diagnostics = result.get(nodeId) ?? [];
    diagnostics.push(diagnostic);
    result.set(nodeId, diagnostics);
  }

  return result;
}

function resolveTargetNode(compiled: CompiledLineage, target: string): string | undefined {
  const source = compiled.lineage.nodes.find((node) => node.kind === "source");
  if (target === "source" || target.startsWith("source.") || target.startsWith("privacy.")) {
    return source?.id;
  }

  const structureId = target.match(/^structures\.([^.]+)/)?.[1];
  if (structureId && hasNode(compiled, structureId)) return structureId;

  const transformId = target.match(/^transforms\.([^.]+)/)?.[1];
  if (transformId && hasNode(compiled, transformId)) return transformId;

  return undefined;
}

function hasNode(compiled: CompiledLineage, id: string): boolean {
  return compiled.lineage.nodes.some((node) => node.id === id);
}

function highestSeverity(diagnostics: ProfileDiagnostic[]): DiagnosticSeverity {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) return "error";
  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) return "warning";
  return "info";
}

function mermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function escapeMermaid(value: string): string {
  return value.replaceAll('"', "'").replaceAll("\\n", "<br/>");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function nodeTitle(node: DataStructureLineageNode): string {
  const diagnostics = node.diagnostics.map((diagnostic) => (
    `${diagnostic.severity}: ${diagnostic.code} - ${diagnostic.message}`
  ));
  return [node.label, node.kind, node.taxonomyRef, ...diagnostics].join("\n");
}
