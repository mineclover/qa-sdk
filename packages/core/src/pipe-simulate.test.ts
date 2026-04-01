import { describe, it, expect } from "vitest";
import { simulate } from "./pipe-simulate.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "./types/pipe-spec.js";
import { step } from "./__fixtures__/pipe-fixtures.js";

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

  describe("연산자 동작 안정화", () => {
    // ── loop 반복 ──────────────────────────────────────

    it("loop — branchResolver가 0 반환 시 maxIterations까지 반복", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "loop", body: step("반복"), until: "done", maxIterations: 3 },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      // branchResolver 기본(0) → until 조건 미충족 → 3회 반복
      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      // loop 스텝 1 + body 스텝 3 = 4
      const bodySteps = result.steps.filter(s => s.kind === "step");
      expect(bodySteps).toHaveLength(3);
      expect(result.facetTrace).toEqual(["반복", "반복", "반복"]);
    });

    it("loop — branchResolver가 truthy 반환 시 조기 종료", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "loop", body: step("반복"), until: "done", maxIterations: 10 },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      let callCount = 0;
      const result = simulate({
        graph,
        initialEvent: { eventKey: "start" },
        // 2회 실행 후 종료 (첫 번째, 두 번째 호출에서 0, 세 번째에서 1)
        branchResolver: (condition) => {
          if (condition === "done") {
            callCount++;
            return callCount >= 2 ? 1 : 0;
          }
          return 0;
        },
      });

      const bodySteps = result.steps.filter(s => s.kind === "step");
      expect(bodySteps).toHaveLength(2);
    });

    it("loop — maxIterations 기본값 10", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "loop", body: step("반복"), until: "never" },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      const bodySteps = result.steps.filter(s => s.kind === "step");
      expect(bodySteps).toHaveLength(10);
    });

    // ── tap 에러 격리 ──────────────────────────────────

    it("tap — observe 에러가 메인 step에 전파되지 않음", () => {
      // observe가 실행되고 step도 실행됨 (정상 경로)
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "tap",
            observe: step("관측"),
            step: step("메인"),
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toContain("관측");
      expect(result.facetTrace).toContain("메인");
      expect(result.status).toBe("complete");
    });

    it("tap — observe/step 모두 실행됨", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "tap",
            observe: step("관측"),
            step: step("메인"),
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toEqual(["관측", "메인"]);
      expect(result.totalSteps).toBe(2);
    });

    // ── dedup 중복 제거 ────────────────────────────────

    it("dedup — 첫 번째는 통과, 동일 키 두 번째는 filtered", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "sequence",
            steps: [
              { kind: "dedup", keyField: "orderId", step: step("처리1") },
              { kind: "dedup", keyField: "orderId", step: step("처리2") },
            ],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      // 첫 번째 dedup: 통과 → step 실행
      expect(result.facetTrace).toContain("처리1");
      // 두 번째 dedup: 이미 본 키 → filtered
      const dedupFiltered = result.steps.filter(s => s.kind === "dedup" && s.status === "filtered");
      expect(dedupFiltered).toHaveLength(1);
      expect(result.facetTrace).not.toContain("처리2");
    });

    it("dedup — 서로 다른 키는 모두 통과", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "sequence",
            steps: [
              { kind: "dedup", keyField: "orderId", step: step("처리A") },
              { kind: "dedup", keyField: "userId", step: step("처리B") },
            ],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toContain("처리A");
      expect(result.facetTrace).toContain("처리B");
    });

    // ── filter 기록 ────────────────────────────────────

    it("filter — 통과 시 executed 스텝 기록 + 내부 step 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "filter", condition: "valid", step: step("검증") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      const filterStep = result.steps.find(s => s.kind === "filter");
      expect(filterStep).toBeDefined();
      expect(filterStep!.status).toBe("executed");
      expect(result.facetTrace).toContain("검증");
    });

    it("filter — 차단 시 filtered 스텝 기록, 내부 step 미실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "filter", condition: "valid", step: step("검증") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({
        graph,
        initialEvent: { eventKey: "start" },
        filterResolver: () => false,
      });
      const filterStep = result.steps.find(s => s.kind === "filter");
      expect(filterStep).toBeDefined();
      expect(filterStep!.status).toBe("filtered");
      expect(result.facetTrace).not.toContain("검증");
    });

    // ── parallel ───────────────────────────────────────

    it("parallel — 모든 병렬 step 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "parallel",
            steps: [step("A"), step("B"), step("C")],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("parallel");
      expect(result.facetTrace).toEqual(["A", "B", "C"]);
    });

    // ── race ───────────────────────────────────────────

    it("race — raceResolver가 선택한 인덱스만 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "race",
            steps: [step("느림"), step("빠름"), step("중간")],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({
        graph,
        initialEvent: { eventKey: "start" },
        raceResolver: () => 1,
      });
      expect(result.facetTrace).toEqual(["빠름"]);
    });

    it("race — 기본 raceResolver는 첫 번째(0) 선택", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "race",
            steps: [step("첫번째"), step("두번째")],
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toEqual(["첫번째"]);
    });

    // ── retry ──────────────────────────────────────────

    it("retry — 성공 경로 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "retry", step: step("시도"), maxAttempts: 3 },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("retry");
      expect(result.facetTrace).toContain("시도");
    });

    // ── fallback ───────────────────────────────────────

    it("fallback — 성공 시 try 경로", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "fallback",
            try: step("주경로"),
            catch: step("대체경로"),
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.facetTrace).toEqual(["주경로"]);
    });

    it("fallback — 실패 시 catch 경로", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "fallback",
            try: step("주경로"),
            catch: step("대체경로"),
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({
        graph,
        initialEvent: { eventKey: "start" },
        failureResolver: () => false,
      });
      expect(result.facetTrace).toEqual(["대체경로"]);
    });

    // ── compensate ─────────────────────────────────────

    it("compensate — forward 경로만 실행 (정상 시)", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "compensate",
            forward: step("전진"),
            compensate: step("보상"),
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("compensate");
      expect(result.facetTrace).toEqual(["전진"]);
    });

    // ── map ────────────────────────────────────────────

    it("map — itemFlow 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "map", collection: "items", itemFlow: step("변환") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("map");
      expect(result.facetTrace).toContain("변환");
    });

    // ── reduce ─────────────────────────────────────────

    it("reduce — step 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "reduce", step: step("집계"), initial: "0", accumulator: "sum" },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("reduce");
      expect(result.facetTrace).toContain("집계");
    });

    // ── split ──────────────────────────────────────────

    it("split — itemFlow 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "split", splitBy: "type", itemFlow: step("분할처리") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("split");
      expect(result.facetTrace).toContain("분할처리");
    });

    // ── enrich ─────────────────────────────────────────

    it("enrich — step 실행 + timeout 시간 경과", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "enrich", source: "db", mergeField: "user", step: step("보강"), timeout: 100 },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start", timestamp: 0 } });
      expect(result.steps[0].kind).toBe("enrich");
      expect(result.facetTrace).toContain("보강");
      expect(result.totalTime).toBeGreaterThanOrEqual(100);
    });

    // ── throttle ───────────────────────────────────────

    it("throttle — step 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: { kind: "throttle", rate: 10, interval: 1000, step: step("제한") },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("throttle");
      expect(result.facetTrace).toContain("제한");
    });

    // ── circuit-breaker ────────────────────────────────

    it("circuit-breaker — 정상 시 step 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "circuit-breaker",
            step: step("보호대상"),
            failureThreshold: 5, cooldown: 3000,
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("circuit-breaker");
      expect(result.facetTrace).toContain("보호대상");
    });

    // ── correlation ────────────────────────────────────

    it("correlation — onMatch 실행", () => {
      const graph: PipeGraph = {
        graphId: "g1", version: "v1",
        pipes: [{
          pipeId: "p1", version: "v1",
          trigger: { eventKey: "start" },
          flow: {
            kind: "correlation",
            requestEvent: "req", responseEvent: "res",
            correlationKey: "txId",
            onMatch: step("매칭"),
          },
        }],
        connections: [],
        entryPipeId: "p1",
      };

      const result = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(result.steps[0].kind).toBe("correlation");
      expect(result.facetTrace).toContain("매칭");
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

