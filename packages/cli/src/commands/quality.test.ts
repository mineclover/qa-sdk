import { existsSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DefinitionEntry } from "definition-catalog";
import type { QualityGateSpec } from "work-domain";
import {
  buildGateDiagnosis,
  buildQualityRunJsonResult,
  buildQualityStatusArtifactRegistryRecord,
  buildReviewBindings,
  buildClaimAuditBindings,
  collectClaimAuditReviewScopes,
  evaluateGateRunResult,
  extractSourceFileBindings,
  rankNextDocs,
  selectNextDocs,
  parseQualityCommandArgs,
  type LoadedQualityDoc,
  cliQuality,
} from "./quality.js";
import { USAGE, resolveSubcommand } from "../index.js";

function makeDoc(
  id: string,
  gateOverrides: Partial<QualityGateSpec> = {},
): LoadedQualityDoc {
  const gate: QualityGateSpec = {
    kind: "typecheck",
    workDomain: "productivity",
    command: `pnpm --filter ${id} typecheck`,
    ...gateOverrides,
  };

  const entry: DefinitionEntry = {
    id,
    title: id,
    scope: "constraint",
    aspect: "tech_constraint",
    depth: "validation",
    lifecycle: "approved",
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
    gate,
  };

  return {
    entry: entry as DefinitionEntry & { readonly gate: QualityGateSpec },
    absPath: `/tmp/${id}.md`,
    purpose: `${id} purpose`,
  };
}

describe("selectNextDocs", () => {
  it("명시된 suggestOnPass를 우선 사용한다", () => {
    const current = makeDoc("gate-a", { suggestOnPass: ["gate-c"] });
    const docs = [current, makeDoc("gate-b"), makeDoc("gate-c")];

    const next = selectNextDocs(current, docs, "pass");
    expect(next.map((doc) => doc.entry.id)).toEqual(["gate-c"]);
  });

  it("명시적 추천이 없으면 암묵 fallback을 만들지 않는다", () => {
    const current = makeDoc("gate-a", { storyId: "US-1" });
    const docs = [
      current,
      makeDoc("gate-b", { storyId: "US-1" }),
      makeDoc("gate-c", { storyId: "US-2" }),
    ];

    const next = selectNextDocs(current, docs, "pass");
    expect(next).toEqual([]);
  });
});

describe("quality claim audit helpers", () => {
  it("gate package와 bundle svc에서 review scope를 도출한다", () => {
    const scopes = collectClaimAuditReviewScopes(
      {
        id: "bundle-a",
        title: "bundle-a",
        version: 0,
        scope: "flow",
        aspect: "process_flow",
        depth: "overview",
        serviceId: "definition-service",
      },
      [
        {
          id: "gate-a",
          title: "gate-a",
          version: 0,
          scope: "constraint",
          aspect: "tech_constraint",
          depth: "validation",
          gate: {
            kind: "typecheck",
            workDomain: "productivity",
            package: "definition-service",
            command: "pnpm --filter definition-service test",
          },
        },
      ],
    );

    expect(scopes).toEqual(["definition-service"]);
  });

  it("package scope가 있으면 marker별 claim binding을 만든다", () => {
    const bindings = buildClaimAuditBindings(["definition-service"]);
    expect(bindings.length).toBeGreaterThan(0);
    expect(bindings[0]!.implementation?.bindings).toContain("scope:definition-service");
    expect(bindings[0]!.implementation?.implementedBindings).toContain("scope:definition-service");
  });

  it("문서 본문에 적힌 소스 경로에서 구현/테스트 바인딩을 추출한다", () => {
    const rootDir = join(import.meta.dirname, "../../../..");
    const bindings = extractSourceFileBindings(`
- \`work-domain/src/harness.ts\`
- \`cli/src/commands/quality.ts\`
`, rootDir);

    expect(bindings.implementation).toEqual([
      "packages/cli/src/commands/quality.ts",
      "packages/work-domain/src/harness.ts",
    ]);
    expect(bindings.tests).toEqual([
      "packages/cli/src/commands/quality.test.ts",
      "packages/work-domain/src/harness.test.ts",
    ]);
  });

  it("review는 구현 바인딩된 파일에 대해서만 붙는다", () => {
    const bindings = buildReviewBindings(
      [
        {
          sourceId: "contract-a",
          implementation: {
            bindings: ["packages/work-domain/src/harness.ts"],
            implementedBindings: ["packages/work-domain/src/harness.ts"],
          },
        },
      ],
      [
        {
          filePath: "packages/work-domain/src/harness.ts",
          status: "reviewed",
          serviceScope: "work-domain",
          lastEntry: null,
          latestFileCommit: null,
        },
        {
          filePath: "packages/work-domain/src/other.ts",
          status: "stale",
          serviceScope: "work-domain",
          lastEntry: null,
          latestFileCommit: null,
        },
      ],
    );

    expect(bindings[0]!.review).toEqual({ reviewed: true, accepted: true });
    expect(bindings[0]!.stale).not.toBe(true);
  });
});

describe("quality CLI surface", () => {
  it("usage와 subcommand 해석에 quality export를 노출한다", () => {
    expect(USAGE).toContain("qa-sdk quality export [bundle-id] [--output=<path>] [--artifact-registry=<file>]");
    expect(resolveSubcommand(["quality", "export", "quality-gates-system", "--output=artifacts/status.json"])).toEqual({
      name: "quality export",
      rest: ["quality-gates-system", "--output=artifacts/status.json"],
    });
  });

  it("quality diagnose를 tree 기반으로 해석한다", () => {
    expect(resolveSubcommand(["quality", "diagnose", "gate-id", "--json"])).toEqual({
      name: "quality diagnose",
      rest: ["gate-id", "--json"],
    });
  });

  it("quality command parser accepts split output and artifact-registry flags", () => {
    const parsed = parseQualityCommandArgs([
      "export",
      "quality-gates-system",
      "--output",
      "artifacts/quality-gates-system.json",
      "--artifact-registry",
      "artifacts/programming-artifacts.json",
      "--scan",
      "--json",
    ]);

    expect(parsed.positional).toEqual(["export", "quality-gates-system"]);
    expect(parsed.flags).toMatchObject({
      output: "artifacts/quality-gates-system.json",
      "artifact-registry": "artifacts/programming-artifacts.json",
      json: "true",
    });
    expect(parsed.sourceOptions.mode).toBe("scan");
  });

  it("quality export does not write output or registry records when the root is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-quality-export-missing-"));
    await mkdir(join(dir, "docs"));
    const outputPath = join(dir, "missing-root.json");
    const registryPath = join(dir, "programming-artifacts.json");
    const previousExitCode = process.exitCode;

    try {
      process.exitCode = undefined;
      const output = await captureConsoleAsync(async () => {
        await cliQuality([
          "export",
          "missing-quality-root",
          "--output",
          outputPath,
          "--artifact-registry",
          registryPath,
          "--scan",
        ], { rootDir: dir });
      });

      expect(output.stderr).toContain('bundle/system 문서 "missing-quality-root" 없음');
      expect(process.exitCode).toBe(1);
      expect(existsSync(outputPath)).toBe(false);
      expect(existsSync(registryPath)).toBe(false);
    } finally {
      process.exitCode = previousExitCode;
    }
  }, 20_000);
});

describe("quality artifact registry records", () => {
  it("quality export snapshot을 quality-status registry record로 변환한다", () => {
    const record = buildQualityStatusArtifactRegistryRecord({
      rootDir: "/repo",
      rootId: "quality-gates-system",
      output: "/repo/artifacts/quality-gates-system.json",
      snapshot: {
        rootId: "quality-gates-system",
        generatedAt: "2026-04-12T00:00:00.000Z",
        bundles: [
          {
            bundleId: "definition-quality-gates",
            title: "Definition quality gates",
            gateCount: 2,
            claimCount: 3,
            verifiedClaimCount: 3,
            bundleState: "verified",
            verifiedGates: 2,
            totalGates: 2,
            reviewScopes: [],
          },
          {
            bundleId: "cli-quality-gates",
            title: "CLI quality gates",
            gateCount: 3,
            claimCount: 2,
            verifiedClaimCount: 1,
            bundleState: "partial",
            verifiedGates: 1,
            totalGates: 3,
            reviewScopes: [],
          },
        ],
      },
    });

    expect(record).toMatchObject({
      artifactId: "quality-status-quality-gates-system",
      artifactRef: "artifacts/quality-gates-system.json",
      kind: "quality-status",
      producedByRef: "qa-sdk quality export quality-gates-system",
      ownerDefinitionId: "quality-gates-system",
      materializesOutputRefs: ["quality-gates-system"],
      outputPath: "artifacts/quality-gates-system.json",
    });
    expect(record.derivedFromRefs).toEqual([
      "quality-gates-system",
      "definition-quality-gates",
      "cli-quality-gates",
    ]);
    expect(record.verifiesRefs).toEqual([
      "quality-gates-system",
      "definition-quality-gates",
      "cli-quality-gates",
    ]);
    expect(record.verificationRefs).toEqual([
      "definition-quality-gates",
      "cli-quality-gates",
    ]);
    expect(record.metadata).toEqual({
      rootId: "quality-gates-system",
      generatedAt: "2026-04-12T00:00:00.000Z",
      bundleCount: 2,
      bundleStates: {
        "definition-quality-gates": "verified",
        "cli-quality-gates": "partial",
      },
      totals: {
        verifiedGateCount: 3,
        totalGateCount: 5,
        claimCount: 5,
        verifiedClaimCount: 4,
      },
      bundles: [
        {
          bundleId: "definition-quality-gates",
          bundleState: "verified",
          verifiedGateCount: 2,
          totalGateCount: 2,
          claimCount: 3,
          verifiedClaimCount: 3,
        },
        {
          bundleId: "cli-quality-gates",
          bundleState: "partial",
          verifiedGateCount: 1,
          totalGateCount: 3,
          claimCount: 2,
          verifiedClaimCount: 1,
        },
      ],
    });
    expect(record.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "verifies",
          toRef: "definition-quality-gates",
        }),
        expect.objectContaining({
          kind: "materializes_output",
          toRef: "quality-gates-system",
        }),
      ]),
    );
  });
});

describe("evaluateGateRunResult", () => {
  it("exit_code=0 패턴은 정상 종료면 통과로 본다", () => {
    const result = evaluateGateRunResult({
      gateKind: "typecheck",
      exitCode: 0,
      stdout: "",
      stderr: "",
      successPattern: "exit_code=0",
    });

    expect(result).toEqual({ outcome: "pass", successPatternMatched: true });
  });

  it("stdout contains 패턴이 불일치하면 실패한다", () => {
    const result = evaluateGateRunResult({
      gateKind: "unit-test",
      exitCode: 0,
      stdout: "all green",
      stderr: "",
      successPattern: "stdout contains \"done\"",
    });

    expect(result.outcome).toBe("fail");
    expect(result.failureClass).toBe("success-pattern-mismatch");
    expect(result.successPatternMatched).toBe(false);
    expect(result.note).toContain("successPattern mismatch");
  });

  it("지원하지 않는 successPattern은 exit code 기준으로 fallback한다", () => {
    const result = evaluateGateRunResult({
      gateKind: "typecheck",
      exitCode: 0,
      stdout: "",
      stderr: "",
      successPattern: "json.path $.status == ok",
    });

    expect(result.outcome).toBe("pass");
    expect(result.successPatternMatched).toBeNull();
    expect(result.note).toContain("unsupported successPattern");
  });

  it("정적 게이트 실패는 static-check-failure로 분류한다", () => {
    const result = evaluateGateRunResult({
      gateKind: "typecheck",
      exitCode: 2,
      stdout: "",
      stderr: "boom",
      successPattern: "stdout contains \"done\"",
    });

    expect(result.outcome).toBe("fail");
    expect(result.failureClass).toBe("static-check-failure");
    expect(result.successPatternMatched).toBe(false);
  });

  it("command not found는 별도 분류한다", () => {
    const result = evaluateGateRunResult({
      gateKind: "build",
      exitCode: 127,
      stdout: "",
      stderr: "pnpm: command not found",
      successPattern: "exit_code=0",
    });

    expect(result.failureClass).toBe("command-not-found");
  });

  it("네트워크 계열 실패는 infra-transient로 분류한다", () => {
    const result = evaluateGateRunResult({
      gateKind: "build",
      exitCode: 1,
      stdout: "",
      stderr: "fetch failed: ECONNRESET",
      successPattern: "exit_code=0",
    });

    expect(result.failureClass).toBe("infra-transient");
  });
});

describe("buildQualityRunJsonResult", () => {
  it("bundle verification과 next 후보를 JSON 결과로 묶는다", () => {
    const result = buildQualityRunJsonResult({
      gateDocId: "gate-a",
      bundleId: "bundle-a",
      command: "pnpm test",
      outcome: "fail",
      exitCode: 1,
      durationMs: 234,
      note: "command exited with code 1",
      failureClass: "build-failure",
      successPattern: "exit_code=0",
      successPatternMatched: false,
      git: {
        repoRoot: "/repo",
        branch: "feature/json",
        sha: "abc123",
      },
      diagnosis: {
        gateDocId: "gate-a",
        status: "failed",
        summary: "빌드가 실패했다.",
        failureClass: "build-failure",
        flaky: false,
        recommendations: ["qa-sdk quality diagnose gate-a"],
        recentOutcomes: ["fail"],
        lastRun: null,
      },
      bundleVerification: {
        bundleId: "bundle-a",
        verified: false,
        verifiedGates: 1,
        totalGates: 2,
        gateStatuses: new Map(),
        blockingGateStatuses: [
          { gateDocId: "gate-b", status: "failed" },
        ],
      },
      rankedNextDocs: [
        {
          doc: makeDoc("gate-b", { kind: "typecheck" }),
          score: 123,
          status: "failed",
          reasons: ["명시적 suggest 경로"],
        },
      ],
      stdout: "stdout",
      stderr: "stderr",
    });

    expect(result).toMatchObject({
      gateDocId: "gate-a",
      bundleId: "bundle-a",
      outcome: "fail",
      durationMs: 234,
      failureClass: "build-failure",
      successPatternMatched: false,
      git: {
        repoRoot: "/repo",
        branch: "feature/json",
        sha: "abc123",
      },
      diagnosis: {
        failureClass: "build-failure",
      },
      bundleVerification: {
        verified: false,
        verifiedGates: 1,
        totalGates: 2,
        blockers: [{ gateDocId: "gate-b", status: "failed" }],
      },
      next: {
        onOutcome: "fail",
        candidates: ["gate-b"],
        ranked: [{
          gateDocId: "gate-b",
          score: 123,
          status: "failed",
          reasons: ["명시적 suggest 경로"],
        }],
      },
      stdout: "stdout",
      stderr: "stderr",
    });
  });
});

describe("buildGateDiagnosis", () => {
  it("실행 이력이 없으면 run 추천을 만든다", () => {
    const diagnosis = buildGateDiagnosis({
      gateDocId: "gate-a",
      status: {
        gateDocId: "gate-a",
        currentVersion: 1,
        status: "unverified",
        lastRun: null,
      },
      history: [],
      nextCandidateIds: [],
    });

    expect(diagnosis.summary).toContain("실행 이력");
    expect(diagnosis.recommendations).toContain("qa-sdk quality run gate-a");
  });

  it("successPattern 불일치는 gate spec 진단으로 분류한다", () => {
    const diagnosis = buildGateDiagnosis({
      gateDocId: "gate-a",
      status: {
        gateDocId: "gate-a",
        currentVersion: 1,
        status: "failed",
        lastRun: {
          id: 1,
          gateDocId: "gate-a",
          docVersion: 1,
          bundleId: "bundle-a",
          command: "pnpm test",
          outcome: "fail",
          exitCode: 0,
          executedAt: "2026-03-30T00:00:00.000Z",
          notes: "successPattern mismatch",
          repoRoot: "/repo",
          gitBranch: "feature/a",
          gitSha: "abc",
          runDurationMs: 10,
          successPattern: "stdout contains \"done\"",
          successPatternMatched: false,
          failureClass: "success-pattern-mismatch",
        },
      },
      history: [
        {
          id: 1,
          gateDocId: "gate-a",
          docVersion: 1,
          bundleId: "bundle-a",
          command: "pnpm test",
          outcome: "fail",
          exitCode: 0,
          executedAt: "2026-03-30T00:00:00.000Z",
          notes: "successPattern mismatch",
          repoRoot: "/repo",
          gitBranch: "feature/a",
          gitSha: "abc",
          runDurationMs: 10,
          successPattern: "stdout contains \"done\"",
          successPatternMatched: false,
          failureClass: "success-pattern-mismatch",
        },
      ],
      nextCandidateIds: ["gate-b"],
    });

    expect(diagnosis.failureClass).toBe("success-pattern-mismatch");
    expect(diagnosis.summary).toContain("successPattern");
  });
});

describe("rankNextDocs", () => {
  it("build 실패 후에는 typecheck를 더 우선시한다", () => {
    const current = makeDoc("gate-build", { kind: "build" });
    const typecheck = makeDoc("gate-typecheck", { kind: "typecheck" });
    const testGate = makeDoc("gate-test", { kind: "unit-test" });

    const ranked = rankNextDocs({
      current,
      candidates: [testGate, typecheck],
      outcome: "fail",
      candidateStatuses: new Map([
        ["gate-typecheck", {
          gateDocId: "gate-typecheck",
          currentVersion: 1,
          status: "unverified",
          lastRun: null,
        }],
        ["gate-test", {
          gateDocId: "gate-test",
          currentVersion: 1,
          status: "unverified",
          lastRun: null,
        }],
      ]),
      diagnosis: {
        gateDocId: "gate-build",
        status: "failed",
        summary: "명령이 exit code 1로 실패했다.",
        failureClass: "build-failure",
        flaky: false,
        recommendations: [],
        recentOutcomes: ["fail"],
        lastRun: null,
      },
    });

    expect(ranked.map((entry) => entry.doc.entry.id)).toEqual([
      "gate-typecheck",
      "gate-test",
    ]);
    expect(ranked[0]!.reasons).toContain("build 실패의 선행 정적 검증");
  });
});

async function captureConsoleAsync(run: () => Promise<void>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}
