#!/usr/bin/env tsx
// scripts/sim-scale.ts
// spec 05 §2 break-glass: Pass 2 자동 scale 결정을 우회하는 두 채널.
//   --replicas <n>  → docker compose --scale 직접 spawn
//   --pin / --unpin → controller에 service-level pin flag 설정 (Pass 2 SKIP, evidence 기록)
//
// pin/unpin은 멱등이며 --replicas와 동시 사용은 거부. 모든 호출은 audit-recorder write를 동반.
//
// Plan defects (실제 sim-identifier-grammar API 기준 보정):
//   - 패키지명: plan "@qa-sdk-sim/identifier-grammar" → 실제 "sim-identifier-grammar"
//   - buildDecisionId: { pass, cycleId } (revision 필드 없음)
//   - buildCycleId: { controllerId, cycleAt } — 운영자 채널은 controllerId="OPERATOR"

import { Command } from "commander";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildDecisionId, buildCycleId } from "sim-identifier-grammar";
import { recordOperatorAction } from "./break-glass-shared/audit-recorder-client.js";
import { resolveOperatorIdentity } from "./break-glass-shared/operator-identity.js";

const OPERATOR_CONTROLLER_ID = "OPERATOR";

interface ScaleSetOpts {
  service: string;
  replicas?: number;
  pin?: boolean;
  unpin?: boolean;
  reason: string;
  composeFile: string;
  composeProject: string;
  controllerUrl: string;
  auditUrl: string;
  dryRun: boolean;
}

async function runDocker(args: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

async function runPinUnpin(
  opts: ScaleSetOpts,
  operator: string,
  decisionId: string,
): Promise<void> {
  if (!opts.pin && !opts.unpin) {
    process.stderr.write("--replicas, --pin, --unpin 중 하나는 필수\n");
    process.exitCode = 2;
    return;
  }
  const pinned = !!opts.pin;
  const path = pinned ? "/admin/controller/pin" : "/admin/controller/unpin";
  if (opts.dryRun) {
    process.stdout.write(
      JSON.stringify({
        call: `POST ${path}`,
        body: { service: opts.service, reason: opts.reason },
      }) + "\n",
    );
    return;
  }
  const res = await fetch(`${opts.controllerUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ service: opts.service, reason: opts.reason }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    process.stderr.write(`pin/unpin failed: ${res.status}\n`);
    process.exitCode = 2;
    return;
  }
  await recordOperatorAction(opts.auditUrl, {
    decisionId,
    operatorAction: true,
    actor: operator,
    command: pinned ? "sim-scale set --pin" : "sim-scale set --unpin",
    service: opts.service,
    action: { kind: pinned ? "scale-pin" : "scale-unpin" },
    reason: opts.reason,
  });
  process.stdout.write(
    `[OK] scale ${pinned ? "pin" : "unpin"} applied: ${opts.service}\n`,
  );
}

export function buildSimScale(): Command {
  const cmd = new Command();
  cmd.name("sim-scale").description("스케일 break-glass 운영자 명령");

  cmd
    .command("set")
    .description("replica 수동 고정 또는 controller scale 결정 pin")
    .requiredOption("--service <name>", "대상 서비스")
    .requiredOption("--reason <text>", "운영자 사유")
    .option("--replicas <n>", "강제 replica 수", (v) => Number.parseInt(v, 10))
    .option("--pin", "controller scale 결정 pin", false)
    .option("--unpin", "pin 해제 (멱등)", false)
    .option(
      "--compose-file <p>",
      "compose yaml",
      "simulations/enterprise-pm/docker-compose.sim.yaml",
    )
    .option("--compose-project <n>", "compose project", "enterprise-pm")
    .option(
      "--controller-url <url>",
      "controller admin URL",
      "http://localhost:7100",
    )
    .option("--audit-url <url>", "audit-recorder URL", "http://localhost:5100")
    .option("--dry-run", "실제 호출 없이 의도된 명령만 출력", false)
    .action(async (opts: ScaleSetOpts) => {
      const operator = resolveOperatorIdentity();
      const cycleId = buildCycleId({
        controllerId: OPERATOR_CONTROLLER_ID,
        cycleAt: Date.now(),
      });
      const decisionId = buildDecisionId({ pass: "resource", cycleId });

      if (opts.replicas !== undefined && (opts.pin || opts.unpin)) {
        process.stderr.write("--replicas는 --pin/--unpin과 동시 사용 불가\n");
        process.exitCode = 2;
        return;
      }
      if (opts.replicas !== undefined) {
        const args = [
          "compose",
          "-f",
          opts.composeFile,
          "-p",
          opts.composeProject,
          "up",
          "-d",
          "--no-deps",
          "--scale",
          `${opts.service}=${opts.replicas}`,
          opts.service,
        ];
        if (opts.dryRun) {
          process.stdout.write(
            JSON.stringify({ call: "docker", args }) + "\n",
          );
          return;
        }
        const code = await runDocker(args);
        if (code !== 0) {
          process.stderr.write(
            `docker compose --scale failed: exit ${code}\n`,
          );
          process.exitCode = 2;
          return;
        }
        await recordOperatorAction(opts.auditUrl, {
          decisionId,
          operatorAction: true,
          actor: operator,
          command: "sim-scale set --replicas",
          service: opts.service,
          action: { kind: "scale-set", replicas: opts.replicas },
          reason: opts.reason,
        });
        process.stdout.write(
          `[OK] scale set: ${opts.service} replicas=${opts.replicas}\n`,
        );
        return;
      }
      return runPinUnpin(opts, operator, decisionId);
    });

  return cmd;
}

const isMain =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  buildSimScale()
    .parseAsync(process.argv)
    .catch((err) => {
      process.stderr.write(
        `sim-scale: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exitCode = 1;
    });
}
