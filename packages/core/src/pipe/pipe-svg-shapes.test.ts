// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from "vitest";
import { drawEdgePath, drawPortDots, standaloneEdgeSvg, standaloneNodeSvg } from "viz-core";
import type { PipePort } from "../types/pipe-spec.js";

describe("drawPortDots", () => {
  it("입출력 포트를 좌우 경계에 균등 배치한다", () => {
    const ports: PipePort[] = [
      { portId: "order", direction: "in", facetType: "order.created" },
      { portId: "result", direction: "out", facetType: "order.validated" },
    ];

    const svg = drawPortDots(10, 20, 100, 60, ports);

    expect(svg).toContain('class="port-dot port-dot-in"');
    expect(svg).toContain('class="port-dot port-dot-out"');
    expect(svg).toContain('cx="10" cy="50"');
    expect(svg).toContain('cx="110" cy="50"');
    expect(svg).toContain("<title>order (order.created)</title>");
    expect(svg).toContain("<title>result (order.validated)</title>");
  });

  it("facetType이 없으면 기본 색상을 사용한다", () => {
    const svg = drawPortDots(0, 0, 80, 40, [
      { portId: "input", direction: "in" },
    ]);

    expect(svg).toContain('fill="#90a4ae"');
  });
});

describe("standaloneNodeSvg", () => {
  it("ports가 있으면 boundary dot을 포함한다", () => {
    const svg = standaloneNodeSvg({
      role: "transformer",
      label: "Normalize",
      ports: [
        { portId: "order", direction: "in", facetType: "order.created" },
        { portId: "normalized", direction: "out", facetType: "order.normalized" },
      ],
    });

    expect(svg).toContain('class="port-dots"');
    expect(svg).toContain("<title>order (order.created)</title>");
    expect(svg).toContain("<title>normalized (order.normalized)</title>");
  });

  it("ports가 없으면 기존 노드 렌더링만 유지한다", () => {
    const svg = standaloneNodeSvg({
      role: "transformer",
      label: "Normalize",
    });

    expect(svg).not.toContain('class="port-dots"');
    expect(svg).toContain(">Normalize</text>");
  });
});

describe("drawEdgePath", () => {
  it("facetType이 있으면 edge 중간에 pill 라벨을 렌더링한다", () => {
    const svg = drawEdgePath(20, 40, 180, 40, {
      kind: "event",
      facetType: "payment.result",
    });

    expect(svg).toContain('class="edge-facet-label"');
    expect(svg).toContain('font-size="10"');
    expect(svg).toContain('font-family="monospace"');
    expect(svg).toContain(">payment.result</text>");
    expect(svg).toContain('fill-opacity="0.78"');
  });
});

describe("standaloneEdgeSvg", () => {
  it("facetType이 있으면 standalone edge에도 라벨을 포함한다", () => {
    const svg = standaloneEdgeSvg({
      kind: "next",
      facetType: "order.normalized",
    });

    expect(svg).toContain('class="edge-facet-label"');
    expect(svg).toContain(">order.normalized</text>");
  });
});
