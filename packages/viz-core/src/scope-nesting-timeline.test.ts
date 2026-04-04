import { describe, it, expect } from "vitest";
import {
  buildTimelineRows,
  scopeTimelineToSvg,
  scopeTimelineToD3,
  SCOPE_DEPTH_COLORS,
  TIMING_COLORS,
  type ScopeTimelineData,
} from "./scope-nesting-timeline.js";

// ── 테스트 데이터 ────────────────────────────────────

function makeData(overrides?: Partial<ScopeTimelineData>): ScopeTimelineData {
  return {
    nesting: {
      nestingId: "test",
      scopes: [
        {
          scopeId: "app",
          provides: [{ contractId: "state", type: "state" }],
          consumes: [],
          facets: ["생산"],
        },
        {
          scopeId: "feature",
          provides: [],
          consumes: [{ contractId: "state", required: true }],
          facets: ["소비", "관리"],
        },
      ],
    },
    validation: {
      valid: true,
      issues: [],
      descentPaths: [{
        contractId: "state",
        providedBy: "app",
        consumedBy: ["feature"],
        providerDepth: 0,
      }],
    },
    snapshots: [
      { depth: 0, scopeId: "app", activeContracts: ["state"], pipes: ["init"] },
      { depth: 1, scopeId: "feature", activeContracts: ["state"], pipes: ["handler"] },
    ],
    ...overrides,
  };
}

// ── buildTimelineRows ────────────────────────────────

describe("buildTimelineRows", () => {
  it("scope 행을 depth 순서로 생성한다", () => {
    const rows = buildTimelineRows(makeData());
    const scopeRows = rows.filter(r => r.type === "scope");

    expect(scopeRows).toHaveLength(2);
    expect(scopeRows[0].id).toBe("app");
    expect(scopeRows[1].id).toBe("feature");
    expect(scopeRows[0].blocks[0].color).toBe(SCOPE_DEPTH_COLORS[0]);
    expect(scopeRows[1].blocks[0].color).toBe(SCOPE_DEPTH_COLORS[1]);
  });

  it("timing이 있으면 contract 행을 생성한다", () => {
    const rows = buildTimelineRows(makeData({
      timing: {
        valid: true,
        issues: [],
        readinessTimeline: [
          { contractId: "state", readyAtStep: 0 },
          { contractId: "logging", readyAtStep: 3 },
        ],
        delegationGaps: [],
      },
      simulation: { steps: [], pipeTrace: [], facetTrace: [], producedEvents: [], status: "complete", totalTime: 0, totalSteps: 5 },
    }));
    const contractRows = rows.filter(r => r.type === "contract");

    expect(contractRows).toHaveLength(2);
    // state: 즉시 ready → 블록 1개
    expect(contractRows[0].blocks).toHaveLength(1);
    expect(contractRows[0].blocks[0].color).toBe(TIMING_COLORS.ready);
    // logging: pending → ready → 블록 2개
    expect(contractRows[1].blocks).toHaveLength(2);
    expect(contractRows[1].blocks[0].color).toBe(TIMING_COLORS.pending);
    expect(contractRows[1].blocks[1].color).toBe(TIMING_COLORS.ready);
    expect(contractRows[1].blocks[1].marker?.position).toBe(3);
  });

  it("simulation이 있으면 pipe 행을 생성한다", () => {
    const rows = buildTimelineRows(makeData({
      simulation: {
        steps: [
          { pipeId: "init", flowPath: "root", kind: "step", facet: "setup", eventKey: "init.triggered", timestamp: 0, status: "executed" },
          { pipeId: "handler", flowPath: "root", kind: "step", facet: "handle", eventKey: "handler.triggered", timestamp: 1, status: "executed" },
        ],
        pipeTrace: ["init", "handler"],
        facetTrace: ["setup", "handle"],
        producedEvents: [],
        status: "complete",
        totalTime: 2,
        totalSteps: 2,
      },
    }));
    const pipeRows = rows.filter(r => r.type === "pipe");

    expect(pipeRows).toHaveLength(2);
    expect(pipeRows[0].id).toBe("pipe:init");
    expect(pipeRows[1].id).toBe("pipe:handler");
  });

  it("delegation gap을 delegation 행으로 생성한다", () => {
    const rows = buildTimelineRows(makeData({
      timing: {
        valid: false,
        issues: [],
        readinessTimeline: [],
        delegationGaps: [{
          contractId: "state",
          delegatorPipeId: "init",
          gapStartStep: 1,
          gapEndStep: 3,
          staleConsumers: ["feature"],
        }],
      },
    }));
    const delegationRows = rows.filter(r => r.type === "delegation");

    expect(delegationRows).toHaveLength(1);
    expect(delegationRows[0].blocks[0].start).toBe(1);
    expect(delegationRows[0].blocks[0].end).toBe(3);
    expect(delegationRows[0].blocks[0].color).toBe(TIMING_COLORS.delegation);
  });

  it("timing/simulation 없으면 scope 행만 반환한다", () => {
    const rows = buildTimelineRows(makeData());
    expect(rows.every(r => r.type === "scope")).toBe(true);
    expect(rows).toHaveLength(2);
  });
});

// ── scopeTimelineToSvg ──────────────────────────────

describe("scopeTimelineToSvg", () => {
  it("유효한 SVG를 반환한다", () => {
    const svg = scopeTimelineToSvg(makeData());

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("app");
    expect(svg).toContain("feature");
  });

  it("showRows 필터가 동작한다", () => {
    const data = makeData({
      timing: {
        valid: true,
        issues: [],
        readinessTimeline: [{ contractId: "state", readyAtStep: 0 }],
        delegationGaps: [],
      },
      simulation: { steps: [], pipeTrace: [], facetTrace: [], producedEvents: [], status: "complete", totalTime: 0, totalSteps: 5 },
    });
    const svgAll = scopeTimelineToSvg(data);
    const svgScopeOnly = scopeTimelineToSvg(data, { showRows: ["scope"] });

    // scope-only는 contract 라벨이 없어야 함
    expect(svgAll).toContain("state");
    expect(svgScopeOnly).not.toContain("timeline-contract");
  });

  it("빈 데이터에도 SVG를 반환한다", () => {
    const svg = scopeTimelineToSvg({
      nesting: { nestingId: "empty", scopes: [] },
      validation: { valid: true, issues: [], descentPaths: [] },
      snapshots: [],
    });
    expect(svg).toContain("<svg");
  });
});

// ── scopeTimelineToD3 ───────────────────────────────

describe("scopeTimelineToD3", () => {
  it("rows, stepCount, width, height를 반환한다", () => {
    const d3 = scopeTimelineToD3(makeData());

    expect(d3.rows).toHaveLength(2);
    expect(d3.stepCount).toBe(2);
    expect(d3.width).toBe(960);
    expect(d3.height).toBeGreaterThan(0);
  });

  it("showRows 필터가 D3에서도 동작한다", () => {
    const data = makeData({
      timing: {
        valid: true,
        issues: [],
        readinessTimeline: [{ contractId: "state", readyAtStep: 0 }],
        delegationGaps: [],
      },
      simulation: { steps: [], pipeTrace: [], facetTrace: [], producedEvents: [], status: "complete", totalTime: 0, totalSteps: 5 },
    });
    const d3All = scopeTimelineToD3(data);
    const d3ScopeOnly = scopeTimelineToD3(data, { showRows: ["scope"] });

    expect(d3All.rows.length).toBeGreaterThan(d3ScopeOnly.rows.length);
    expect(d3ScopeOnly.rows.every(r => r.type === "scope")).toBe(true);
  });
});
