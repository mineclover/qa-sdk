import { describe, expect, it } from "vitest";
import type { PipeGraph, PipeSpec } from "../types/pipe-spec.js";
import { step } from "./__fixtures__/pipe-fixtures.js";
import { inferPortsFromDataContract, resolvePorts } from "./pipe-port.js";
import { validatePipeGraph } from "./pipe-validate.js";

function makePipe(pipeId: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return {
    pipeId,
    version: "v1",
    trigger: { eventKey: `${pipeId}.triggered` },
    flow: step(),
    ...overrides,
  };
}

describe("inferPortsFromDataContract", () => {
  it("dataContract만 있는 step에서 ports를 도출한다", () => {
    const pipe = makePipe("contract-only", {
      flow: step("관리", undefined, {
        dataContract: {
          consumes: {
            order: { type: "order.created", required: true },
          },
          produces: {
            result: { type: "order.validated", required: false },
          },
        },
      }),
    });

    expect(inferPortsFromDataContract(pipe)).toEqual([
      { direction: "in", portId: "order", facetType: "order.created", required: true },
      { direction: "out", portId: "result", facetType: "order.validated", required: false },
    ]);
  });

  it("leaf가 아닌 flow는 하위 step들의 ports를 집계한다", () => {
    const pipe = makePipe("aggregate", {
      flow: {
        kind: "sequence",
        steps: [
          step("소비", undefined, {
            dataContract: {
              consumes: {
                orderId: { type: "order.id", required: true },
              },
            },
          }),
          {
            kind: "parallel",
            steps: [
              step("생산", undefined, {
                dataContract: {
                  produces: {
                    paymentResult: { type: "payment.result", required: true },
                  },
                },
              }),
              {
                kind: "timeout",
                duration: 1000,
                body: step("저장", undefined, {
                  dataContract: {
                    consumes: {
                      auditId: { type: "audit.id", required: false },
                    },
                    produces: {
                      auditSaved: { type: "audit.saved", required: true },
                    },
                  },
                }),
              },
            ],
          },
        ],
      },
    });

    expect(inferPortsFromDataContract(pipe)).toEqual([
      { direction: "in", portId: "orderId", facetType: "order.id", required: true },
      { direction: "out", portId: "paymentResult", facetType: "payment.result", required: true },
      { direction: "in", portId: "auditId", facetType: "audit.id", required: false },
      { direction: "out", portId: "auditSaved", facetType: "audit.saved", required: true },
    ]);
  });
});

describe("resolvePorts", () => {
  it("명시 ports가 있으면 dataContract 추론보다 우선한다", () => {
    const pipe = makePipe("explicit", {
      ports: [
        { direction: "in", portId: "manualInput", facetType: "manual.input", required: true },
      ],
      flow: step("관리", undefined, {
        dataContract: {
          consumes: {
            ignored: { type: "ignored.input", required: true },
          },
        },
      }),
    });

    expect(resolvePorts(pipe)).toEqual([
      { direction: "in", portId: "manualInput", facetType: "manual.input", required: true },
    ]);
  });

  it("PortRef 검증은 inferred ports도 사용한다", () => {
    const source = makePipe("source", {
      flow: step("생산", undefined, {
        dataContract: {
          produces: {
            paymentResult: { type: "payment.result", required: true },
          },
        },
      }),
    });
    const target = makePipe("target", {
      flow: step("소비", undefined, {
        dataContract: {
          consumes: {
            paymentInput: { type: "payment.result", required: true },
          },
        },
      }),
    });
    const graph: PipeGraph = {
      graphId: "g-inferred-ports",
      version: "v1",
      pipes: [source, target],
      connections: [
        {
          from: { pipeId: "source", portId: "paymentResult" },
          to: { pipeId: "target", portId: "paymentInput" },
          kind: "event",
          facetType: "payment.result",
        },
      ],
      entryPipeId: "source",
    };

    expect(validatePipeGraph(graph).find(issue => issue.severity === "error")).toBeUndefined();
  });
});
