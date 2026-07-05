#!/usr/bin/env tsx
/**
 * sim:smoke:full — 1차 사이클 마감 검증 (Plan E §13.4).
 *
 * 순서 (spec 05 §4: 인프라 gate → 시나리오 매트릭스):
 *   1) identifier-grammar 라운드트립 (sim-identifier-grammar 단위 테스트)
 *   2) identifier 정적 lint (host.docker.internal grep + image tag + label key)
 *   3) catalog 4-way 정합성 (services × prefixes × env × controller-config)
 *   4) ESLint flat config — qa-sdk-sim/no-write-datasource-in-bff +
 *      qa-sdk-sim/no-write-call-on-read-datasource (silent skip if eslint not installed)
 *   5) ESLint rule unit tests (node:test) — eslint-rules/*.test.js
 *   6) sim-scenarios 정적 PASS — 17 시나리오 등록/타입 검증 (vitest)
 *   7) (옵션) sim-scenarios 통합 실행 — `--all` runner. SIM_SMOKE_RUN_E2E=1 시에만.
 *
 * 실패 시 즉시 abort + 어느 단계에서 끊겼는지 식별 가능한 종료 코드.
 *
 * spec 05 §4 매핑은 각 stage.spec 컬럼에 명시.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");

interface Stage {
  id: string;
  label: string;
  cmd: string;
  args: readonly string[];
  cwd?: string;
  // spec 05 §4 매핑 (어느 검증 항목에 대응하는지)
  spec: string;
  // 실행 전 skip 판단 — false 반환 시 stage skip + sentinel 메시지 출력
  shouldRun?: () => boolean;
  // shouldRun=false 시 출력할 사유
  skipReason?: string;
}

const RUN_E2E = process.env.SIM_SMOKE_RUN_E2E === "1";

const STAGES: readonly Stage[] = [
  {
    id: "grammar-roundtrip",
    label: "identifier-grammar 라운드트립",
    cmd: "corepack",
    args: ["pnpm", "--filter", "sim-identifier-grammar", "test"],
    spec: "05 §4 #1",
  },
  {
    id: "identifier-lint",
    label: "identifier 정적 lint (host.docker.internal grep + image tag + label key)",
    cmd: "corepack",
    args: ["pnpm", "sim:lint:identifiers"],
    spec: "05 §4 #2 + #4",
  },
  {
    id: "catalog-validate",
    label: "catalog 4-way 정합성",
    cmd: "corepack",
    args: [
      "pnpm",
      "--filter",
      "@qa-sdk-sim/enterprise-pm",
      "sim:catalog:validate",
    ],
    spec: "05 §4 #3",
  },
  {
    id: "eslint-flat-config",
    label: "ESLint flat config (BFF write import + read write call 차단)",
    cmd: "corepack",
    args: [
      "pnpm",
      "exec",
      "eslint",
      "simulations/enterprise-pm/services",
    ],
    spec: "05 §4 #5 + #6",
    shouldRun: () =>
      existsSync(resolve(ROOT, "node_modules/eslint")) ||
      existsSync(resolve(ROOT, "node_modules/.bin/eslint")),
    skipReason:
      "eslint 미설치 — flat config는 dormant. node:test 기반 rule 단위 테스트가 다음 stage에서 검증.",
  },
  {
    id: "eslint-rule-unit-tests",
    label: "ESLint rule 단위 테스트 (node:test)",
    cmd: "node",
    args: [
      "--test",
      "eslint-rules/no-write-datasource-in-bff.test.js",
      "eslint-rules/no-write-call-on-read-datasource.test.js",
    ],
    spec: "05 §4 #5 + #6 (rule logic 검증)",
  },
  {
    id: "sim-scenarios-static",
    label: "sim-scenarios 정적 PASS (17 시나리오 등록/타입)",
    cmd: "corepack",
    args: ["pnpm", "--filter", "@qa-sdk/sim-scenarios", "test"],
    spec: "06 §5 DoD #2 (정적 검증)",
  },
  {
    id: "sim-scenarios-e2e",
    label: "sim-scenarios e2e 통합 실행 (17 시나리오 --all)",
    cmd: "corepack",
    args: [
      "pnpm",
      "--filter",
      "@qa-sdk/sim-scenarios",
      "start",
      "run",
      "--all",
      "--mode",
      "in-process",
    ],
    spec: "05 §3 + 06 §5 DoD #2 (통합 실행)",
    shouldRun: () => RUN_E2E,
    skipReason:
      "SIM_SMOKE_RUN_E2E=1 미설정 — 통합 실행은 sops + docker compose 부팅 필요. 정적 PASS만 검증.",
  },
] as const;

interface StageResult {
  id: string;
  label: string;
  spec: string;
  status: "passed" | "skipped" | "failed";
  exit?: number;
  skipReason?: string;
}

function runStage(stage: Stage): StageResult {
  if (stage.shouldRun && !stage.shouldRun()) {
    process.stdout.write(
      `\n[sim:smoke:full] ⊘ SKIP ${stage.label} (${stage.spec})\n`,
    );
    process.stdout.write(`  reason: ${stage.skipReason ?? "(no reason)"}\n`);
    return {
      id: stage.id,
      label: stage.label,
      spec: stage.spec,
      status: "skipped",
      skipReason: stage.skipReason,
    };
  }

  process.stdout.write(
    `\n[sim:smoke:full] ▶ ${stage.label} (${stage.spec})\n`,
  );
  const r = spawnSync(stage.cmd, [...stage.args], {
    stdio: "inherit",
    cwd: stage.cwd ?? ROOT,
    env: process.env,
  });
  if (r.status !== 0) {
    return {
      id: stage.id,
      label: stage.label,
      spec: stage.spec,
      status: "failed",
      exit: r.status ?? -1,
    };
  }
  return {
    id: stage.id,
    label: stage.label,
    spec: stage.spec,
    status: "passed",
  };
}

function main(): number {
  const results: StageResult[] = [];
  let firstFail: StageResult | null = null;

  for (const stage of STAGES) {
    const r = runStage(stage);
    results.push(r);
    if (r.status === "failed" && !firstFail) {
      firstFail = r;
      // fail-fast: 후속 stage는 stage 의존 가능성으로 위장 실패 가능 (spec 05 §6 분류 트리).
      break;
    }
  }

  process.stdout.write("\n[sim:smoke:full] === 요약 ===\n");
  for (const r of results) {
    const mark =
      r.status === "passed" ? "✓" : r.status === "skipped" ? "⊘" : "✗";
    process.stdout.write(`  ${mark} ${r.id} (${r.spec}) — ${r.status}\n`);
    if (r.skipReason) {
      process.stdout.write(`      ${r.skipReason}\n`);
    }
  }

  if (firstFail) {
    process.stderr.write(
      `\n[sim:smoke:full] ✗ FAIL @ stage=${firstFail.id} spec=${firstFail.spec} exit=${firstFail.exit}\n`,
    );
    process.stderr.write(
      "[sim:smoke:full] 진단 가이드: spec 05 §6 분류 트리 — 본 단계 실패가 후속 단계의 위장 실패를 만들 수 있으므로 본 단계만 먼저 fix.\n",
    );
    return 2;
  }

  const passedCount = results.filter((r) => r.status === "passed").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  process.stdout.write(
    `\n[sim:smoke:full] ✓ ${passedCount} PASS / ${skippedCount} SKIP — 1차 사이클 DoD 후보 충족\n`,
  );
  process.stdout.write(
    "[sim:smoke:full] 다음 절차: 단계 13 Task 13.5 — 완료-보고.md DoD 체크리스트 확정\n",
  );
  return 0;
}

process.exitCode = main();
