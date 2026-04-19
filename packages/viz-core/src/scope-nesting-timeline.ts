// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * Scope Nesting 통합 타임라인
 *
 * ScopeNesting + 시뮬레이션 결과 → 행 기반 타임라인 (SVG / D3).
 * 기존 pipe-svg primitives + shapes 토큰을 재사용.
 */

import type {
  ScopeNesting, NestingValidation,
  MountSnapshot,
  TimingValidation, ReadinessEntry, DelegationGap,
  SimulationResult, SimStep,
} from "@qa-sdk/core";
import { svgRect, svgText, svgLine, svgGroup, svgSvg } from "./primitives.js";

// ── 타임라인 전용 토큰 ───────────────────────────────

/** depth별 scope 배경색 (0~3, 이후 순환) */
export const SCOPE_DEPTH_COLORS = ["#b2ebf2", "#c5cae9", "#f8bbd0", "#ffe0b2"] as const;

/** contract type별 색상 */
export const CONTRACT_TYPE_COLORS: Record<string, string> = {
  state: "#42a5f5",
  logging: "#ffca28",
  persist: "#66bb6a",
  adapter: "#ab47bc",
  custom: "#78909c",
};

/** timing 상태 색상 */
export const TIMING_COLORS = {
  pending: "#ef5350",
  ready: "#66bb6a",
  delegation: "#ec407a",
} as const;

// ── 타임라인 타입 ────────────────────────────────────

export type RowType = "scope" | "contract" | "pipe" | "delegation";

export interface TimelineBlock {
  start: number;
  end: number;
  color: string;
  opacity: number;
  label?: string;
  sublabel?: string;
  marker?: { position: number; color: string };
  tooltip?: Record<string, string>;
}

export interface ScopeTimelineRow {
  type: RowType;
  id: string;
  label: string;
  blocks: TimelineBlock[];
}

export interface ScopeTimelineData {
  nesting: ScopeNesting;
  validation: NestingValidation;
  snapshots: MountSnapshot[];
  timing?: TimingValidation;
  simulation?: SimulationResult;
  bindings?: Record<string, { scopeId: string; scopeContracts: string[] }>;
}

export interface ScopeTimelineSvgOptions {
  width?: number;
  rowHeight?: number;
  padding?: { top: number; bottom: number; left: number; right: number };
  showRows?: RowType[];
}

export interface D3TimelineData {
  rows: ScopeTimelineRow[];
  stepCount: number;
  width: number;
  height: number;
}

// ── 행 조립 ──────────────────────────────────────────

/** ScopeTimelineData → ScopeTimelineRow[] 변환 */
export function buildTimelineRows(data: ScopeTimelineData): ScopeTimelineRow[] {
  const totalSteps = data.simulation?.totalSteps ?? data.snapshots.length;
  const rows: ScopeTimelineRow[] = [];

  // 1. scope 행
  for (let i = 0; i < data.nesting.scopes.length; i++) {
    const scope = data.nesting.scopes[i];
    const snap = data.snapshots[i];
    const provides = scope.provides.map(c => c.contractId).join(", ");
    const facets = scope.facets?.join(", ") ?? "";
    const color = SCOPE_DEPTH_COLORS[i % SCOPE_DEPTH_COLORS.length];

    rows.push({
      type: "scope",
      id: scope.scopeId,
      label: scope.scopeId,
      blocks: [{
        start: 0,
        end: totalSteps,
        color,
        opacity: 0.5,
        label: provides ? `provides: ${provides}` : undefined,
        sublabel: facets ? `facets: ${facets}` : undefined,
        tooltip: {
          scope: scope.scopeId,
          depth: String(i),
          ...(provides ? { provides } : {}),
          ...(snap ? { activeContracts: snap.activeContracts.join(", ") } : {}),
        },
      }],
    });
  }

  // 2. contract 행 (readiness 기반)
  if (data.timing) {
    for (const entry of data.timing.readinessTimeline) {
      const blocks: TimelineBlock[] = [];

      if (entry.readyAtStep <= 0) {
        // 즉시 ready
        blocks.push({
          start: 0,
          end: totalSteps,
          color: TIMING_COLORS.ready,
          opacity: 0.6,
          label: entry.contractId,
          sublabel: "즉시",
        });
      } else {
        // pending → ready 전환
        blocks.push({
          start: 0,
          end: entry.readyAtStep,
          color: TIMING_COLORS.pending,
          opacity: 0.5,
          label: `${entry.contractId} (pending)`,
        });
        blocks.push({
          start: entry.readyAtStep,
          end: totalSteps,
          color: TIMING_COLORS.ready,
          opacity: 0.6,
          label: `${entry.contractId} (ready)`,
          marker: { position: entry.readyAtStep, color: TIMING_COLORS.ready },
        });
      }

      rows.push({
        type: "contract",
        id: `contract:${entry.contractId}`,
        label: entry.contractId,
        blocks,
      });
    }
  }

  // 3. pipe 행 (시뮬레이션 step 기반)
  if (data.simulation) {
    const pipeSteps = new Map<string, SimStep[]>();
    for (const step of data.simulation.steps) {
      const list = pipeSteps.get(step.pipeId) ?? [];
      list.push(step);
      pipeSteps.set(step.pipeId, list);
    }

    for (const [pipeId, steps] of pipeSteps) {
      const blocks: TimelineBlock[] = steps.map((s, idx) => ({
        start: idx,
        end: idx + 1,
        color: s.status === "executed" ? "#42a5f5" : "#bdbdbd",
        opacity: s.status === "executed" ? 0.8 : 0.3,
        label: s.facet ?? s.kind,
        tooltip: {
          pipe: s.pipeId,
          kind: s.kind,
          status: s.status,
          ...(s.facet ? { facet: s.facet } : {}),
          ...(s.eventKey ? { event: s.eventKey } : {}),
        },
      }));

      rows.push({
        type: "pipe",
        id: `pipe:${pipeId}`,
        label: pipeId,
        blocks,
      });
    }
  }

  // 4. delegation gap 행
  if (data.timing) {
    for (const gap of data.timing.delegationGaps) {
      rows.push({
        type: "delegation",
        id: `delegation:${gap.contractId}:${gap.delegatorPipeId}`,
        label: `${gap.contractId} gap`,
        blocks: [{
          start: gap.gapStartStep,
          end: gap.gapEndStep,
          color: TIMING_COLORS.delegation,
          opacity: 0.6,
          label: `${gap.contractId} (${gap.staleConsumers.join(", ")})`,
          marker: { position: gap.gapEndStep, color: TIMING_COLORS.delegation },
          tooltip: {
            contract: gap.contractId,
            delegator: gap.delegatorPipeId,
            consumers: gap.staleConsumers.join(", "),
          },
        }],
      });
    }
  }

  return rows;
}

// ── SVG 렌더링 ───────────────────────────────────────

const DEFAULT_PADDING = { top: 32, bottom: 16, left: 160, right: 16 };
const DEFAULT_WIDTH = 960;
const DEFAULT_ROW_HEIGHT = 36;

export function scopeTimelineToSvg(
  data: ScopeTimelineData,
  options?: ScopeTimelineSvgOptions,
): string {
  const allRows = buildTimelineRows(data);
  const rows = options?.showRows
    ? allRows.filter(r => options.showRows!.includes(r.type))
    : allRows;

  const width = options?.width ?? DEFAULT_WIDTH;
  const rowH = options?.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const pad = options?.padding ?? DEFAULT_PADDING;
  const totalSteps = data.simulation?.totalSteps ?? data.snapshots.length;
  const chartW = width - pad.left - pad.right;
  const height = pad.top + rows.length * rowH + pad.bottom;

  if (rows.length === 0 || totalSteps === 0) {
    return svgSvg(width, Math.max(height, 100), []);
  }

  const stepW = chartW / totalSteps;
  const children: string[] = [];

  // 헤더 — step 눈금
  const tickElements: string[] = [];
  const tickInterval = Math.max(1, Math.ceil(totalSteps / 20));
  for (let i = 0; i <= totalSteps; i += tickInterval) {
    const x = pad.left + i * stepW;
    tickElements.push(svgLine(x, pad.top - 4, x, pad.top, { stroke: "#90a4ae", "stroke-width": 1 }));
    tickElements.push(svgText(x, pad.top - 8, String(i), {
      "text-anchor": "middle", "font-size": 9, fill: "#78909c",
    }));
  }
  children.push(svgGroup(tickElements, { class: "timeline-ticks" }));

  // 행 렌더링
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const y = pad.top + ri * rowH;
    const rowElements: string[] = [];

    // 행 라벨
    rowElements.push(svgText(pad.left - 8, y + rowH / 2 + 4, row.label, {
      "text-anchor": "end", "font-size": 11, fill: "#37474f",
    }));

    // 행 배경 (짝수/홀수 줄무늬)
    if (ri % 2 === 0) {
      rowElements.push(svgRect(pad.left, y, chartW, rowH, {
        fill: "#f5f5f5", opacity: 0.5,
      }));
    }

    // 블록 렌더링
    for (const block of row.blocks) {
      const bx = pad.left + block.start * stepW;
      const bw = Math.max((block.end - block.start) * stepW, 1);
      const by = y + 4;
      const bh = rowH - 8;

      rowElements.push(svgRect(bx, by, bw, bh, {
        rx: 3,
        fill: block.color,
        opacity: block.opacity,
      }));

      // 블록 라벨 (충분한 너비가 있을 때만)
      if (block.label && bw > 40) {
        rowElements.push(svgText(bx + 6, by + bh / 2 + 4, truncate(block.label, bw / 6.5), {
          "font-size": 10, fill: "#263238", "pointer-events": "none",
        }));
      }

      // 수직 마커
      if (block.marker) {
        const mx = pad.left + block.marker.position * stepW;
        rowElements.push(svgLine(mx, y, mx, y + rowH, {
          stroke: block.marker.color, "stroke-width": 2, "stroke-dasharray": "3 2",
        }));
      }
    }

    children.push(svgGroup(rowElements, {
      class: `timeline-row timeline-${row.type}`,
      "data-id": row.id,
    }));
  }

  return svgSvg(width, height, children);
}

// ── D3 변환 ──────────────────────────────────────────

export function scopeTimelineToD3(
  data: ScopeTimelineData,
  options?: ScopeTimelineSvgOptions,
): D3TimelineData {
  const allRows = buildTimelineRows(data);
  const rows = options?.showRows
    ? allRows.filter(r => options.showRows!.includes(r.type))
    : allRows;

  const width = options?.width ?? DEFAULT_WIDTH;
  const rowH = options?.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const pad = options?.padding ?? DEFAULT_PADDING;
  const totalSteps = data.simulation?.totalSteps ?? data.snapshots.length;
  const height = pad.top + rows.length * rowH + pad.bottom;

  return {
    rows,
    stepCount: totalSteps,
    width,
    height,
  };
}

// ── 유틸 ─────────────────────────────────────────────

function truncate(s: string, maxLen: number): string {
  const max = Math.max(3, Math.floor(maxLen));
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
