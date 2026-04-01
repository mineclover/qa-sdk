import { describe, it, expect } from "vitest";
import { simulate } from "./pipe-simulate.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "./types/pipe-spec.js";

const step = (facet = "소비", eventKey?: string): PipeFlow => ({ kind: "step", facet, eventKey });

describe("simulate", () => {
  describe("단일 파이프", () => {
    it("단순 step 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: step("소비"),
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({
        graph,
        initialEvent: { eventKey: "start" },
      });

      expect(result.status).toBe("complete");
      expect(result.pipeTrace).toEqual(["p1"]);
      expect(result.facetTrace).toEqual(["소비"]);
      expect(result.totalSteps).toBe(1);
    });

    it("sequence 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "sequence",
            steps: [step("소비"), step("관리"), step("저장")],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toEqual(["소비", "관리", "저장"]);
      expect(result.totalSteps).toBe(3);
    });

    it("branch — 기본 첫 번째 경로", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "branch", condition: "type",
            paths: [step("생산"), step("저장")],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toEqual(["생산"]);
    });

    it("branch — branchResolver로 두 번째 경로", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "branch", condition: "type",
            paths: [step("생산"), step("저장")],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({
        graph,
        initialEvent: { eventKey: "start" },
        branchResolver: () => 1,
      });
      expect(result.facetTrace).toEqual(["저장"]);
    });

    it("optional — 통과", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "optional", step: step("생산") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toEqual(["생산"]);
    });

    it("optional — 스킵", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "optional", step: step("생산") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({
        graph,
        initialEvent: { eventKey: "start" },
        filterResolver: () => false,
      });
      expect(result.facetTrace).toEqual([]);
      expect(result.steps[0].status).toBe("skipped");
    });

    it("emit 이벤트 생산", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "sequence",
            steps: [
              step("소비"),
              { kind: "emit", eventKey: "notify" },
            ],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.producedEvents).toEqual(
        expect.arrayContaining([expect.objectContaining({ eventKey: "notify" })]),
      );
    });

    it("finally — body + cleanup 모두 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "finally",
            body: step("생산"),
            cleanup: step("저장"),
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toEqual(["생산", "저장"]);
    });

    it("debounce — 시간 경과", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "debounce", wait: 300, step: step("소비") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start", timestamp: 0 } });
      expect(result.totalTime).toBeGreaterThanOrEqual(300);
    });
  });

  describe("그래프 연결", () => {
    it("next 연결 — 순차 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [
          { pipeId: "a", version: "v1", trigger: { eventKey: "start" }, flow: step("소비") },
          { pipeId: "b", version: "v1", trigger: { eventKey: "e_b" }, flow: step("생산") },
        ],
        connections: [{ from: "a", to: "b", kind: "next" }],
        entryPipeId: "a",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.pipeTrace).toEqual(["a", "b"]);
      expect(result.facetTrace).toEqual(["소비", "생산"]);
    });

    it("fan-out — 동시 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [
          { pipeId: "a", version: "v1", trigger: { eventKey: "start" }, flow: step("소비") },
          { pipeId: "b", version: "v1", trigger: { eventKey: "e_b" }, flow: step("관리") },
          { pipeId: "c", version: "v1", trigger: { eventKey: "e_c" }, flow: step("저장") },
        ],
        connections: [{ from: "a", to: ["b", "c"], kind: "fan-out" }],
        entryPipeId: "a",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.pipeTrace).toContain("a");
      expect(result.pipeTrace).toContain("b");
      expect(result.pipeTrace).toContain("c");
    });

    it("이벤트 체인 — produces → trigger", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [
          {
            pipeId: "a", version: "v1",
            trigger: { eventKey: "start" },
            flow: step("소비"),
            produces: ["order_confirmed"],
          },
          {
            pipeId: "b", version: "v1",
            trigger: { eventKey: "order_confirmed" },
            flow: step("생산"),
          },
        ],
        connections: [],
        entryPipeId: "a",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.pipeTrace).toEqual(["a", "b"]);
    });

    it("트리거 미매칭 → no-trigger-match", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{ pipeId: "a", version: "v1", trigger: { eventKey: "other" }, flow: step() }],
        connections: [],
        entryPipeId: "a",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "wrong" } });
      expect(result.status).toBe("no-trigger-match");
    });

    it("maxSteps 초과 → max-steps-reached", () => {
      // 무한 이벤트 체인
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "a", version: "v1",
          trigger: { eventKey: "loop" },
          flow: step(),
          produces: ["loop"],
        }],
        connections: [],
        entryPipeId: "a",
      };

      const result = simulate({
        graph,
        initialEvent: { eventKey: "loop" },
        maxSteps: 10,
      });
      expect(result.status).toBe("max-steps-reached");
    });
  });

  describe("실전 시나리오", () => {
    it("주문 처리: 접수 → 결제+재고 → 알림", () => {
      const graph: PipeGraph = {
        graphId: "order-system", version: "v1",
        pipes: [
          {
            pipeId: "order", version: "v1",
            trigger: { eventKey: "order_submitted" },
            flow: { kind: "sequence", steps: [step("소비"), step("관리"), step("저장")] },
            produces: ["order_confirmed"],
          },
          {
            pipeId: "payment", version: "v1",
            trigger: { eventKey: "pay" },
            flow: { kind: "retry", maxAttempts: 3, step: step("관리") },
          },
          {
            pipeId: "inventory", version: "v1",
            trigger: { eventKey: "inv" },
            flow: step("관리"),
          },
          {
            pipeId: "notify", version: "v1",
            trigger: { eventKey: "done" },
            flow: { kind: "emit", eventKey: "notification_sent" },
          },
        ],
        connections: [
          { from: "order", to: ["payment", "inventory"], kind: "fan-out" },
          { from: ["payment", "inventory"], to: "notify", kind: "join" },
        ],
        entryPipeId: "order",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "order_submitted" } });
      expect(result.status).toBe("complete");
      expect(result.pipeTrace).toContain("order");
      expect(result.pipeTrace).toContain("payment");
      expect(result.pipeTrace).toContain("inventory");
      expect(result.pipeTrace).toContain("notify");
      expect(result.producedEvents.map(e => e.eventKey)).toContain("notification_sent");
    });
  });
});
