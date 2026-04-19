// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  flowCompare,
  flowPolicyApprove,
  flowPolicyCandidates,
  flowPolicyLearn,
  flowPolicyList,
  flowPolicyReject,
  getFlowCliStateForTest,
  resetFlowCliStateForTest,
} from "./flow.js";

const COORDINATE_DESIGN_PATH = [
  "new-axis",
  "new-prefix",
  "minimum",
  "in-place",
  "keep-separate",
  "single-owner",
] as const;

const COORDINATE_REUSE_PATH = [
  "reuse-existing",
  "extend-existing",
  "minimum",
  "in-place",
  "keep-separate",
  "single-owner",
] as const;

describe("flow policy CLI", () => {
  beforeEach(() => {
    resetFlowCliStateForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("learn 이후 candidates에서 빈도와 confidence를 보여준다", () => {
    seedCoordinateDesignRuns(5, 0.92);

    const learnOutput = captureConsole(() => {
      flowPolicyLearn(["coordinate-design"]);
    });
    const candidatesOutput = captureConsole(() => {
      flowPolicyCandidates([]);
    });

    expect(learnOutput.stdout).toContain("학습 완료: coordinate-design");
    expect(learnOutput.stdout).toContain("감지된 패턴: 1");
    expect(candidatesOutput.stdout).toContain("Policy Candidates (1)");
    expect(candidatesOutput.stdout).toContain("candidate-");
    expect(candidatesOutput.stdout).toContain("   5");
    expect(candidatesOutput.stdout).toContain("0.92");
  });

  it("approve는 후보를 등록 정책으로 승격하고 list에 노출한다", () => {
    seedCoordinateDesignRuns(5, 0.91);
    flowPolicyLearn(["coordinate-design"]);

    const { workflow, engine } = getFlowCliStateForTest();
    const candidate = workflow.listCandidates("candidate")[0];

    expect(candidate).toBeDefined();

    const approveOutput = captureConsole(() => {
      flowPolicyApprove([candidate!.id]);
    });
    const listOutput = captureConsole(() => {
      flowPolicyList();
    });

    expect(approveOutput.stdout).toContain(`정책 승인 + 등록: ${candidate!.id}`);
    expect(engine.getPolicies("coordinate-design").some((policy) => policy.id === candidate!.id)).toBe(true);
    expect(listOutput.stdout).toContain(candidate!.id);
    expect(listOutput.stdout).toContain("Registered Policies");
  });

  it("reject 후 learn을 다시 실행하면 동일 후보를 재제안하지 않는다", () => {
    seedCoordinateDesignRuns(5, 0.9);
    flowPolicyLearn(["coordinate-design"]);

    const { workflow } = getFlowCliStateForTest();
    const candidate = workflow.listCandidates("candidate")[0];

    expect(candidate).toBeDefined();

    const rejectOutput = captureConsole(() => {
      flowPolicyReject([candidate!.id, "--reason", "수동 검토 필요"]);
    });

    flowPolicyLearn(["coordinate-design"]);

    const candidatesOutput = captureConsole(() => {
      flowPolicyCandidates([]);
    });

    expect(rejectOutput.stdout).toContain(`정책 후보 거부: ${candidate!.id}`);
    expect(workflow.getCandidate(candidate!.id)?.status).toBe("rejected");
    expect(workflow.listCandidates("candidate")).toHaveLength(0);
    expect(candidatesOutput.stdout).toContain("정책 후보 없음");
  });

  it("pairwise compare는 코어 gate 차이를 ★로 표시한다", () => {
    vi.useFakeTimers();
    const instanceAId = seedCoordinateRunAt("2026-03-24T09:00:00.000Z", COORDINATE_DESIGN_PATH);
    const instanceBId = seedCoordinateRunAt("2026-03-24T10:00:00.000Z", COORDINATE_REUSE_PATH);

    const output = captureConsole(() => {
      flowCompare([instanceAId, instanceBId]);
    });

    expect(output.stdout).toContain("Flow Pair Compare");
    expect(output.stdout).toContain("첫 분기점: ★ axis-definition");
    expect(output.stdout).toContain("★ axis-definition");
    expect(output.stdout).toContain("new-axis");
    expect(output.stdout).toContain("reuse-existing");
  });

  it("gate compare는 branch 분포와 dominant branch를 출력한다", () => {
    vi.useFakeTimers();
    seedCoordinateRunAt("2026-03-24T09:00:00.000Z", COORDINATE_DESIGN_PATH);
    seedCoordinateRunAt("2026-03-24T09:10:00.000Z", COORDINATE_DESIGN_PATH);
    seedCoordinateRunAt("2026-03-24T09:20:00.000Z", COORDINATE_DESIGN_PATH);
    seedCoordinateRunAt("2026-03-24T09:30:00.000Z", COORDINATE_DESIGN_PATH);
    seedCoordinateRunAt("2026-03-24T09:40:00.000Z", COORDINATE_REUSE_PATH);

    const output = captureConsole(() => {
      flowCompare(["--gate", "axis-definition", "--schema", "coordinate-design"]);
    });

    expect(output.stdout).toContain("Flow Gate Compare: ★ axis-definition");
    expect(output.stdout).toContain("표본 수: 5");
    expect(output.stdout).toContain("new-axis");
    expect(output.stdout).toContain("80%");
    expect(output.stdout).toContain("dominant");
  });

  it("temporal compare는 직전 동일 길이 기간과 비교해 core shift를 출력한다", () => {
    vi.useFakeTimers();
    seedCoordinateRunAt("2026-03-23T09:00:00.000Z", COORDINATE_DESIGN_PATH);
    seedCoordinateRunAt("2026-03-23T10:00:00.000Z", COORDINATE_DESIGN_PATH);
    seedCoordinateRunAt("2026-03-24T09:00:00.000Z", COORDINATE_REUSE_PATH);
    seedCoordinateRunAt("2026-03-24T10:00:00.000Z", COORDINATE_REUSE_PATH);

    const output = captureConsole(() => {
      flowCompare([
        "--from",
        "2026-03-24T00:00:00.000Z",
        "--to",
        "2026-03-24T23:59:59.999Z",
        "--schema",
        "coordinate-design",
      ]);
    });

    expect(output.stdout).toContain("기간 A: 2026-03-23T00:00:00.000Z ~ 2026-03-23T23:59:59.999Z");
    expect(output.stdout).toContain("기간 B: 2026-03-24T00:00:00.000Z ~ 2026-03-24T23:59:59.999Z");
    expect(output.stdout).toContain("★ axis-definition");
    expect(output.stdout).toContain("new-axis → reuse-existing");
    expect(output.stdout).toContain("새로 등장한 경로");
    expect(output.stdout).toContain("사라진 경로");
  });
});

function seedCoordinateDesignRuns(count: number, confidence: number) {
  const { engine } = getFlowCliStateForTest();

  for (let index = 0; index < count; index += 1) {
    const instance = engine.startFlow("coordinate-design", { scopeMode: "hold" });
    for (const branchId of COORDINATE_DESIGN_PATH) {
      engine.selectBranch(instance.id, branchId, [], { confidence });
    }
  }
}

function seedCoordinateRunAt(
  isoTimestamp: string,
  branchIds: readonly string[],
) {
  vi.setSystemTime(new Date(isoTimestamp));
  const { engine } = getFlowCliStateForTest();
  const instance = engine.startFlow("coordinate-design", { scopeMode: "hold" });
  for (const branchId of branchIds) {
    engine.selectBranch(instance.id, branchId, []);
  }
  return instance.id;
}

function captureConsole(run: () => void) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });

  try {
    run();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}
