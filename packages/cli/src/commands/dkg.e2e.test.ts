import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DkgSqliteStore } from "../../../spec-core/src/store/index.js";

const originalHome = process.env.HOME;
const tempHomes: string[] = [];

describe("dkg CLI E2E", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
  });

  it("dkg decide --type new-axis는 completed FlowInstance와 DecisionNode를 함께 남긴다", async () => {
    const { home, dkgDecide, dkgTrace, loadFlowInstanceMeta } = await loadIsolatedDkgModules();

    const decideOutput = await captureConsoleAsync(async () => {
      await dkgDecide({
        target: "decision_event",
        type: "new-axis",
        title: "새 axis 추가",
        rationale: "decision_event에 새 차원을 확장한다.",
        confirmProceed: async () => true,
      });
    });

    expect(decideOutput.stdout).toContain("══ coordinate-design 브릿지 ══");
    expect(decideOutput.stdout).toContain("✓ 플로우 완료");

    const decisionId = extractLabeledValue(decideOutput.stdout, "id");
    const flowInstanceId = extractLabeledValue(decideOutput.stdout, "flow instance");
    const store = new DkgSqliteStore(join(home, ".qa-sdk", "state.sqlite"), "demo");
    const graph = store.loadGraph();
    const decision = graph.getNode(decisionId);

    expect(decision?.kind).toBe("decision");
    expect(decision && "flowInstanceId" in decision ? decision.flowInstanceId : undefined).toBe(flowInstanceId);

    const instance = loadFlowInstanceMeta(store, flowInstanceId);
    expect(instance?.status).toBe("completed");
    expect(instance?.context.dkgDecisionId).toBe(decisionId);
    expect(instance?.addressContext).toEqual(
      expect.objectContaining({
        decision_event: expect.stringMatching(/^decision_event:v1:\d+$/),
        decision_path: expect.stringMatching(/^decision_path:v1:\d+$/),
      }),
    );

    const traceOutput = captureConsole(() => {
      dkgTrace(decisionId);
    });

    expect(traceOutput.stdout).toContain(`flow:      ${flowInstanceId}`);
    expect(traceOutput.stdout).toContain("── 연결된 FlowInstance 코어 추적 ──");
    expect(traceOutput.stdout).toContain("flow-schema: coordinate-design");
    expect(traceOutput.stdout).toContain(`dkgDecisionId: ${decisionId}`);
    expect(traceOutput.stdout).toContain("★ axis-definition = new-axis");
  });

  it("dkg decide --type merge는 코어 gate 경고를 출력한다", async () => {
    const { dkgDecide } = await loadIsolatedDkgModules();

    const output = await captureConsoleAsync(async () => {
      await dkgDecide({
        target: "decision_event",
        type: "merge",
        title: "prefix merge 검토",
        rationale: "중복 prefix 정리가 필요하다.",
        confirmProceed: async () => true,
      });
    });

    expect(output.stdout).toContain("══ 코어 gate 영향 경고 ══");
    expect(output.stdout).toContain("★ merge-split (merge/split 판정) ← merge");
    expect(output.stdout).toContain("무효화 cascade:");
    expect(output.stdout).toContain("⚠ 코어 gate 무효화 — 전체 재설계 필요");
  });

  it("dkg decide --legacy는 기존 DecisionNode 기록만 남기고 flow 연결은 만들지 않는다", async () => {
    const { home, dkgDecide, dkgTrace } = await loadIsolatedDkgModules();

    const decideOutput = await captureConsoleAsync(async () => {
      await dkgDecide({
        target: "decision_event",
        type: "new-axis",
        title: "legacy 새 axis 추가",
        rationale: "기존 기록 경로 유지 확인",
        legacy: true,
        confirmProceed: async () => true,
      });
    });

    expect(decideOutput.stdout).toContain("legacy 모드 — coordinate-design 브릿지 생략");

    const decisionId = extractLabeledValue(decideOutput.stdout, "id");
    const store = new DkgSqliteStore(join(home, ".qa-sdk", "state.sqlite"), "demo");
    const graph = store.loadGraph();
    const decision = graph.getNode(decisionId);

    expect(decision?.kind).toBe("decision");
    expect(decision && "flowInstanceId" in decision ? decision.flowInstanceId : undefined).toBeUndefined();

    const traceOutput = captureConsole(() => {
      dkgTrace(decisionId);
    });

    expect(traceOutput.stdout).not.toContain("── 연결된 FlowInstance 코어 추적 ──");
    expect(traceOutput.stdout).not.toContain("flow:      ");
  });
});

async function loadIsolatedDkgModules() {
  const home = await mkdtemp(join(tmpdir(), "qa-dkg-e2e-"));
  tempHomes.push(home);
  process.env.HOME = home;
  vi.resetModules();

  const [{ dkgDecide, dkgTrace }, { loadFlowInstanceMeta }] = await Promise.all([
    import("./dkg.js"),
    import("./dkg-decision-flow.js"),
  ]);

  return {
    home,
    dkgDecide,
    dkgTrace,
    loadFlowInstanceMeta,
  };
}

function captureConsole(run: () => void) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });

  try {
    run();
  } finally {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}

async function captureConsoleAsync(run: () => Promise<void>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}

function extractLabeledValue(output: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`^\\s*${escaped}:\\s+(.+)$`, "m"));
  expect(match).not.toBeNull();
  return match![1].trim();
}
