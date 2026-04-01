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
