import { describe, it, expect } from "vitest";
import {
  parseCondition, evaluateCondition,
  CancellationToken, PipeContext, ExecutorRegistry, PipeRunner,
} from "./pipe-runtime.js";
import type { PipeFlow, PipeSpec, PipeGraph } from "./types/pipe-spec.js";
import type { StepResult } from "./types/pipe-runtime.js";

const step = (facet: string, eventKey?: string): PipeFlow => ({ kind: "step", facet, eventKey });

function makePipe(id: string, trigger: string, flow: PipeFlow, produces?: string[]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: trigger }, flow, produces };
}

// ── ConditionEvaluator ───────────────────────────────

describe("parseCondition", () => {
  it("필드 비교: amount > 0", () => {
    const expr = parseCondition("amount > 0");
    expect(expr).toEqual({ type: "field", field: "amount", op: "gt", value: 0 });
  });

  it("문자열 비교: status === 'active'", () => {
    const expr = parseCondition("status === 'active'");
    expect(expr).toEqual({ type: "field", field: "status", op: "eq", value: "active" });
  });

  it("존재 확인: user", () => {
    const expr = parseCondition("user");
    expect(expr).toEqual({ type: "exists", field: "user" });
  });

  it("부재 확인: !deleted", () => {
    const expr = parseCondition("!deleted");
    expect(expr).toEqual({ type: "not-exists", field: "deleted" });
  });

  it("AND 조합: a > 0 && b < 10", () => {
    const expr = parseCondition("a > 0 && b < 10");
    expect(expr.type).toBe("and");
    if (expr.type === "and") expect(expr.children).toHaveLength(2);
  });

  it("OR 조합: x == 1 || y == 2", () => {
    const expr = parseCondition("x == 1 || y == 2");
    expect(expr.type).toBe("or");
  });
});

describe("evaluateCondition", () => {
  function makeCtx(data: Record<string, unknown>): PipeContext {
    return new PipeContext({ triggerEvent: { eventKey: "test" }, pipeId: "p", data });
  }

  it("필드 비교 평가", () => {
    const ctx = makeCtx({ amount: 150 });
    expect(evaluateCondition({ type: "field", field: "amount", op: "gt", value: 0 }, ctx)).toBe(true);
    expect(evaluateCondition({ type: "field", field: "amount", op: "lt", value: 100 }, ctx)).toBe(false);
  });

  it("존재/부재 평가", () => {
    const ctx = makeCtx({ user: { name: "alice" } });
    expect(evaluateCondition({ type: "exists", field: "user" }, ctx)).toBe(true);
    expect(evaluateCondition({ type: "not-exists", field: "deleted" }, ctx)).toBe(true);
  });

  it("중첩 경로 조회: user.name", () => {
    const ctx = makeCtx({ user: { name: "alice" } });
    expect(evaluateCondition({ type: "field", field: "user.name", op: "eq", value: "alice" }, ctx)).toBe(true);
  });

  it("AND/OR 조합 평가", () => {
    const ctx = makeCtx({ a: 5, b: 3 });
    expect(evaluateCondition({
      type: "and",
      children: [
        { type: "field", field: "a", op: "gt", value: 0 },
        { type: "field", field: "b", op: "lt", value: 10 },
      ],
    }, ctx)).toBe(true);
  });
});

// ── CancellationToken ────────────────────────────────

describe("CancellationToken", () => {
  it("취소 전 상태", () => {
    const token = new CancellationToken();
    expect(token.cancelled).toBe(false);
    expect(token.reason).toBeUndefined();
  });

  it("취소 후 상태", () => {
    const token = new CancellationToken();
    token.cancel("timeout");
    expect(token.cancelled).toBe(true);
    expect(token.reason).toBe("timeout");
  });

  it("onCancel 콜백 호출", () => {
    const token = new CancellationToken();
    let called = false;
    token.onCancel(() => { called = true; });
    token.cancel("test");
    expect(called).toBe(true);
  });

  it("이미 취소된 토큰에 onCancel → 즉시 호출", () => {
    const token = new CancellationToken();
    token.cancel("already");
    let called = false;
    token.onCancel(() => { called = true; });
    expect(called).toBe(true);
  });

  it("자식 토큰 — 부모 취소 시 자식도 취소", () => {
    const parent = new CancellationToken();
    const child = parent.child();
    expect(child.cancelled).toBe(false);
    parent.cancel("parent cancelled");
    expect(child.cancelled).toBe(true);
    expect(child.reason).toBe("parent cancelled");
  });
});

// ── PipeContext ───────────────────────────────────────

describe("PipeContext", () => {
  it("get/set 기본", () => {
    const ctx = new PipeContext({ triggerEvent: { eventKey: "e", payload: { x: 1 } }, pipeId: "p" });
    expect(ctx.get("x")).toBe(1);
    ctx.set("y", 2);
    expect(ctx.get("y")).toBe(2);
  });

  it("중첩 경로 get/set", () => {
    const ctx = new PipeContext({ triggerEvent: { eventKey: "e" }, pipeId: "p" });
    ctx.set("user.name", "alice");
    expect(ctx.get("user.name")).toBe("alice");
  });

  it("clone — 독립 복사", () => {
    const ctx = new PipeContext({ triggerEvent: { eventKey: "e", payload: { x: 1 } }, pipeId: "p" });
    const cloned = ctx.clone();
    cloned.set("x", 999);
    expect(ctx.get("x")).toBe(1); // 원본 불변
    expect(cloned.get("x")).toBe(999);
  });

  it("triggerEvent payload → data 초기화", () => {
    const ctx = new PipeContext({
      triggerEvent: { eventKey: "order", payload: { amount: 50000, item: "book" } },
      pipeId: "p",
    });
    expect(ctx.get("amount")).toBe(50000);
    expect(ctx.get("item")).toBe("book");
  });
});

// ── PipeRunner ───────────────────────────────────────

describe("PipeRunner", () => {
  function makeRunner(): PipeRunner {
    const executors = new ExecutorRegistry();

    // 기본 실행기: context에 facet 기록
    for (const facet of ["소비", "관리", "생산", "저장", "정의"]) {
      executors.register({
        facet,
        execute: async (s, ctx) => {
          ctx.set(`_executed.${s.eventKey ?? facet}`, true);
          return { status: "ok", output: ctx.get(s.eventKey ?? facet) ?? `${facet}_done` };
        },
      });
    }

    return new PipeRunner(executors);
  }

  it("단순 step 실행", async () => {
    const runner = makeRunner();
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", step("소비", "read"))],
      connections: [],
      entryPipeId: "p",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.status).toBe("complete");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].facet).toBe("소비");
  });

  it("sequence 순차 실행", async () => {
    const runner = makeRunner();
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", {
        kind: "sequence",
        steps: [step("소비", "a"), step("관리", "b"), step("저장", "c")],
      })],
      connections: [],
      entryPipeId: "p",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.status).toBe("complete");
    const facets = result.steps.filter(s => s.kind === "step").map(s => s.facet);
    expect(facets).toEqual(["소비", "관리", "저장"]);
  });

  it("fallback — try 성공 시 catch 미실행", async () => {
    const runner = makeRunner();
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", {
        kind: "fallback",
        try: step("관리", "primary"),
        catch: step("관리", "backup"),
      })],
      connections: [],
      entryPipeId: "p",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.steps.find(s => s.eventKey === "primary")).toBeDefined();
    expect(result.steps.find(s => s.eventKey === "backup")).toBeUndefined();
  });

  it("fallback — try 실패 시 catch 실행", async () => {
    const executors = new ExecutorRegistry();
    executors.register({
      facet: "관리",
      execute: async (s) => {
        if (s.eventKey === "primary") {
          return { status: "error", error: { code: "FAIL", message: "primary failed", retryable: false } };
        }
        return { status: "ok", output: "backup_ok" };
      },
    });
    const runner = new PipeRunner(executors);

    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", {
        kind: "fallback",
        try: step("관리", "primary"),
        catch: step("관리", "backup"),
      })],
      connections: [],
      entryPipeId: "p",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.steps.find(s => s.eventKey === "backup")).toBeDefined();
  });

  it("retry — retryable 에러 시 재시도", async () => {
    let attempts = 0;
    const executors = new ExecutorRegistry();
    executors.register({
      facet: "관리",
      execute: async () => {
        attempts++;
        if (attempts < 3) {
          return { status: "error", error: { code: "RETRY", message: "retry me", retryable: true } };
        }
        return { status: "ok", output: "success" };
      },
    });
    const runner = new PipeRunner(executors);

    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", { kind: "retry", maxAttempts: 5, backoff: 0, step: step("관리", "api") })],
      connections: [],
      entryPipeId: "p",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.status).toBe("complete");
    expect(attempts).toBe(3);
  });

  it("finally — body 후 cleanup 항상 실행", async () => {
    const runner = makeRunner();
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", {
        kind: "finally",
        body: step("생산", "main"),
        cleanup: step("저장", "cleanup"),
      })],
      connections: [],
      entryPipeId: "p",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.steps.find(s => s.eventKey === "main")).toBeDefined();
    expect(result.steps.find(s => s.eventKey === "cleanup")).toBeDefined();
  });

  it("이벤트 체인: produces → trigger", async () => {
    const runner = makeRunner();
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [
        makePipe("a", "start", step("생산", "create"), ["order_done"]),
        makePipe("b", "order_done", step("소비", "process")),
      ],
      connections: [],
      entryPipeId: "a",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.steps.find(s => s.eventKey === "create")).toBeDefined();
    expect(result.steps.find(s => s.eventKey === "process")).toBeDefined();
  });

  it("conditional 연결 — 조건 평가로 연결 결정", async () => {
    const runner = makeRunner();
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [
        makePipe("router", "start", step("관리", "classify")),
        makePipe("fast", "fast_t", step("생산", "fast_process")),
        makePipe("slow", "slow_t", step("생산", "slow_process")),
      ],
      connections: [
        { from: "router", to: "fast", kind: "conditional", condition: "priority > 5" },
      ],
      entryPipeId: "router",
    };

    // priority > 5 → fast 실행
    const r = await runner.run(graph, { eventKey: "start", payload: { priority: 10 } });
    expect(r.steps.find(s => s.eventKey === "fast_process")).toBeDefined();
  });

  it("maxSteps 보호", async () => {
    const runner = new PipeRunner(new ExecutorRegistry(), 5);
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("a", "loop", step("소비"), ["loop"])],
      connections: [],
      entryPipeId: "a",
    };

    const result = await runner.run(graph, { eventKey: "loop" });
    expect(result.status).toBe("max-steps");
  });

  it("에러 전파 — sequence 내 실패 시 즉시 중단", async () => {
    const executors = new ExecutorRegistry();
    executors.register({
      facet: "관리",
      execute: async (s) => {
        if (s.eventKey === "fail_here") {
          return { status: "error", error: { code: "FAIL", message: "broken", retryable: false } };
        }
        return { status: "ok", output: "ok" };
      },
    });
    executors.register({
      facet: "저장",
      execute: async () => ({ status: "ok", output: "saved" }),
    });
    const runner = new PipeRunner(executors);

    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", {
        kind: "sequence",
        steps: [
          step("관리", "ok_step"),
          step("관리", "fail_here"),
          step("저장", "should_not_run"),
        ],
      })],
      connections: [],
      entryPipeId: "p",
    };

    const result = await runner.run(graph, { eventKey: "start" });
    expect(result.status).toBe("error");
    expect(result.steps.find(s => s.eventKey === "should_not_run")).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("FAIL");
  });
});

// ── 연산자 동작 안정화 ──────────────────────────────

describe("연산자 동작 안정화", () => {
  function makeRunner(): PipeRunner {
    const executors = new ExecutorRegistry();
    for (const facet of ["소비", "관리", "생산", "저장", "정의"]) {
      executors.register({
        facet,
        execute: async (s, ctx) => {
          ctx.set(`_executed.${s.eventKey ?? facet}`, true);
          return { status: "ok", output: ctx.get(s.eventKey ?? facet) ?? `${facet}_done` };
        },
      });
    }
    return new PipeRunner(executors);
  }

  describe("throttle — 속도 제한", () => {
    it("rate 이내 호출은 정상 실행", async () => {
      const runner = makeRunner();
      // rate: 3, interval: 10000ms — 한 윈도우에 3회까지 허용
      const throttleFlow: PipeFlow = { kind: "throttle", rate: 3, interval: 10_000, step: step("소비", "api") };
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [makePipe("p", "start", {
          kind: "sequence",
          steps: [throttleFlow, throttleFlow, throttleFlow],
        })],
        connections: [],
        entryPipeId: "p",
      };

      const result = await runner.run(graph, { eventKey: "start" });
      expect(result.status).toBe("complete");
      // 3회 모두 실행되어야 함 (rate=3)
      const okSteps = result.steps.filter(s => s.kind === "step" && s.status === "ok");
      expect(okSteps.length).toBe(3);
      const skipped = result.steps.filter(s => s.kind === "throttle" && s.status === "skipped");
      expect(skipped.length).toBe(0);
    });

    it("rate 초과 시 skipped 기록", async () => {
      const runner = makeRunner();
      // rate: 2, interval: 10000ms — 2회까지만 허용
      const throttleFlow: PipeFlow = { kind: "throttle", rate: 2, interval: 10_000, step: step("소비", "api") };
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [makePipe("p", "start", {
          kind: "sequence",
          steps: [throttleFlow, throttleFlow, throttleFlow, throttleFlow],
        })],
        connections: [],
        entryPipeId: "p",
      };

      const result = await runner.run(graph, { eventKey: "start" });
      expect(result.status).toBe("complete");
      // 처음 2회는 실행, 나머지 2회는 skip
      const okSteps = result.steps.filter(s => s.kind === "step" && s.status === "ok");
      expect(okSteps.length).toBe(2);
      const skipped = result.steps.filter(s => s.kind === "throttle" && s.status === "skipped");
      expect(skipped.length).toBe(2);
    });
  });

  describe("debounce — 대기 후 실행", () => {
    it("wait 후 step이 실행됨", async () => {
      const runner = makeRunner();
      const debounceFlow: PipeFlow = { kind: "debounce", wait: 10, step: step("소비", "api") };
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [makePipe("p", "start", debounceFlow)],
        connections: [],
        entryPipeId: "p",
      };

      const start = Date.now();
      const result = await runner.run(graph, { eventKey: "start" });
      const elapsed = Date.now() - start;

      expect(result.status).toBe("complete");
      // 내부 step이 실행되어야 함
      const okSteps = result.steps.filter(s => s.kind === "step" && s.status === "ok");
      expect(okSteps.length).toBe(1);
      // wait 시간만큼 지연되었는지 확인
      expect(elapsed).toBeGreaterThanOrEqual(9); // 약간의 타이머 오차 허용
    });
  });

  describe("dedup — 중복 제거", () => {
    it("같은 keyField 값은 두 번째부터 skipped", async () => {
      const runner = makeRunner();
      const dedupFlow: PipeFlow = { kind: "dedup", keyField: "orderId", step: step("소비", "process") };
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [makePipe("p", "start", {
          kind: "sequence",
          steps: [dedupFlow, dedupFlow, dedupFlow],
        })],
        connections: [],
        entryPipeId: "p",
      };

      // 같은 orderId로 3회 호출
      const result = await runner.run(graph, { eventKey: "start", payload: { orderId: "order-123" } });
      expect(result.status).toBe("complete");
      // 첫 번째만 실행, 나머지 2회 skip
      const okSteps = result.steps.filter(s => s.kind === "step" && s.status === "ok");
      expect(okSteps.length).toBe(1);
      const skipped = result.steps.filter(s => s.kind === "dedup" && s.status === "skipped");
      expect(skipped.length).toBe(2);
    });

    it("다른 keyField 값은 각각 실행", async () => {
      const executors = new ExecutorRegistry();
      let callCount = 0;
      executors.register({
        facet: "소비",
        execute: async (s, ctx) => {
          callCount++;
          // 매 호출마다 orderId를 변경하여 다른 키로 만듦
          ctx.set("orderId", `order-${callCount}`);
          return { status: "ok", output: `done-${callCount}` };
        },
      });
      const runner = new PipeRunner(executors);

      // sequence: step(orderId 변경) → dedup → step(orderId 변경) → dedup
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [makePipe("p", "start", {
          kind: "sequence",
          steps: [
            step("소비", "set1"),
            { kind: "dedup", keyField: "orderId", step: step("소비", "process") } as PipeFlow,
            step("소비", "set2"),
            { kind: "dedup", keyField: "orderId", step: step("소비", "process2") } as PipeFlow,
          ],
        })],
        connections: [],
        entryPipeId: "p",
      };

      const result = await runner.run(graph, { eventKey: "start", payload: { orderId: "order-0" } });
      expect(result.status).toBe("complete");
      // 중복이 없으므로 dedup skip이 없어야 함
      const skipped = result.steps.filter(s => s.kind === "dedup" && s.status === "skipped");
      expect(skipped.length).toBe(0);
    });
  });

  describe("filter — 조건 불일치 시 skipped 기록", () => {
    it("조건 참 → step 실행", async () => {
      const runner = makeRunner();
      const filterFlow: PipeFlow = { kind: "filter", condition: "amount > 100", step: step("소비", "process") };
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [makePipe("p", "start", filterFlow)],
        connections: [],
        entryPipeId: "p",
      };

      const result = await runner.run(graph, { eventKey: "start", payload: { amount: 200 } });
      expect(result.status).toBe("complete");
      const okSteps = result.steps.filter(s => s.kind === "step" && s.status === "ok");
      expect(okSteps.length).toBe(1);
      const skipped = result.steps.filter(s => s.kind === "filter" && s.status === "skipped");
      expect(skipped.length).toBe(0);
    });

    it("조건 거짓 → skipped ExecutedStep 기록", async () => {
      const runner = makeRunner();
      const filterFlow: PipeFlow = { kind: "filter", condition: "amount > 100", step: step("소비", "process") };
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [makePipe("p", "start", filterFlow)],
        connections: [],
        entryPipeId: "p",
      };

      const result = await runner.run(graph, { eventKey: "start", payload: { amount: 50 } });
      expect(result.status).toBe("complete");
      // step은 실행되지 않아야 함
      const okSteps = result.steps.filter(s => s.kind === "step" && s.status === "ok");
      expect(okSteps.length).toBe(0);
      // filter skipped 기록이 있어야 함
      const skipped = result.steps.filter(s => s.kind === "filter" && s.status === "skipped");
      expect(skipped.length).toBe(1);
      expect(skipped[0].status).toBe("skipped");
    });
  });
});
