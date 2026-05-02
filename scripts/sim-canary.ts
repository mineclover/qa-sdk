#!/usr/bin/env tsx
// scripts/sim-canary.ts
// spec 05 §2 break-glass: 카나리 자동 결정을 무력화하는 운영자 명령 (abort / force-promote / controller stop).
// 모든 호출 직후 audit-recorder write가 일어나며, 실패는 fail-closed로 exit code 비-0를 남긴다.
//
// Plan defects (실제 API 기준 보정):
//   - 패키지명: plan은 "@qa-sdk-sim/identifier-grammar"라 적었으나 실제는 "sim-identifier-grammar".
//   - buildDecisionId 시그니처: { pass, cycleId } (revision 필드 없음).
//   - buildCycleId 시그니처: { controllerId, cycleAt } (kind/at 필드 없음).
//   - transitionState/getCurrentTopology은 in-memory CatalogPrefixDefinition을 받는 라이브러리 API.
//     본 사이클에서는 catalog HTTP 엔드포인트가 없으므로 force-promote 비-dry-run은 명시적 실패로 보고.
//     (Stage 13 통합 검증에서 catalog read API + transitionState 와이어링 필요.)

import { Command } from "commander";
import {
  buildDecisionId,
  buildCycleId,
  type DecisionPass,
} from "sim-identifier-grammar";
import { recordOperatorAction } from "./break-glass-shared/audit-recorder-client.js";
import { resolveOperatorIdentity } from "./break-glass-shared/operator-identity.js";

interface CommonOpts {
  controllerUrl: string;
  gatewayAdminUrl: string;
  auditUrl: string;
  service: string;
  prefix: string;
  reason: string;
  dryRun: boolean;
}

// 운영자 채널의 controllerId 자리는 "OPERATOR"로 고정 (8 chars [0-9A-Z]).
// CycleId grammar는 controllerId를 합성 문자열에 임베드하지 않고 메타로만 보존한다 (cycle-id.ts §drift §18).
// 따라서 audit-recorder는 cycleId(ULID) + 운영자 actor identity를 별도 필드로 함께 기록.
const OPERATOR_CONTROLLER_ID = "OPERATOR";

function newDecisionId(pass: DecisionPass): string {
  const cycleId = buildCycleId({
    controllerId: OPERATOR_CONTROLLER_ID,
    cycleAt: Date.now(),
  });
  return buildDecisionId({ pass, cycleId });
}

function commonOptions(cmd: Command): Command {
  return cmd
    .requiredOption("--service <name>", "대상 서비스")
    .requiredOption("--prefix <id>", "catalog prefix")
    .requiredOption("--reason <text>", "운영자 사유 (audit evidence)")
    .option("--controller-url <url>", "controller admin URL", "http://localhost:7100")
    .option("--gateway-admin-url <url>", "gateway admin URL", "http://localhost:8889")
    .option("--audit-url <url>", "audit-recorder URL", "http://localhost:5100")
    .option("--dry-run", "실제 호출 없이 의도된 API call만 출력", false);
}

export function buildSimCanary(): Command {
  const cmd = new Command();
  cmd.name("sim-canary").description("카나리 break-glass 운영자 명령");

  // -- abort: weight=0 push + controller hold ----------------------------
  commonOptions(cmd.command("abort"))
    .description("카나리 즉시 중단 (weight=0 + controller hold)")
    .option("--hold-until <iso>", "hold 만료 ISO timestamp")
    .action(async (opts: CommonOpts & { holdUntil?: string }) => {
      const operator = resolveOperatorIdentity();
      const decisionId = newDecisionId("safety");
      const holdUntil =
        opts.holdUntil ?? new Date(Date.now() + 3600_000).toISOString();
      const action = {
        kind: "weight-update" as const,
        weight: 0,
        revision: Date.now(),
      };
      if (opts.dryRun) {
        process.stdout.write(
          JSON.stringify({
            call: "POST /admin/routing",
            body: { service: opts.service, ...action },
          }) + "\n",
        );
        process.stdout.write(
          JSON.stringify({
            call: "POST /admin/controller/hold",
            body: { service: opts.service, holdUntil },
          }) + "\n",
        );
        return;
      }
      const r1 = await fetch(`${opts.gatewayAdminUrl}/admin/routing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: opts.service, ...action }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!r1.ok) {
        process.stderr.write(`abort: gateway push failed ${r1.status}\n`);
        process.exitCode = 2;
        return;
      }
      await fetch(`${opts.controllerUrl}/admin/controller/hold`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: opts.service, holdUntil }),
        signal: AbortSignal.timeout(5_000),
      });
      await recordOperatorAction(opts.auditUrl, {
        decisionId,
        operatorAction: true,
        actor: operator,
        command: "sim-canary abort",
        service: opts.service,
        prefix: opts.prefix,
        action,
        holdUntil,
        reason: opts.reason,
      });
      process.stdout.write(
        `[OK] abort applied: ${opts.service} weight=0 holdUntil=${holdUntil}\n`,
      );
    });

  // -- force-promote: catalog 전이 + weight=100 push ---------------------
  commonOptions(cmd.command("force-promote"))
    .description("카나리 강제 승격 (위험) — catalog 전이 + 이전 stable retired")
    .action(async (opts: CommonOpts) => {
      const operator = resolveOperatorIdentity();
      const decisionId = newDecisionId("safety");
      // dry-run은 실제 catalog 조회 없이 의도된 호출 셋만 출력 (audit-recorder/네트워크 부수효과 0).
      // spec 05 §2: force-promote는 catalog 두 전이(candidate→stable, stable→retired) + weight=100 push.
      const transitions = [
        { prefix: opts.prefix, from: "candidate", to: "stable" },
        { prefix: opts.prefix, from: "stable", to: "retired" },
      ] as const;
      if (opts.dryRun) {
        for (const t of transitions) {
          process.stdout.write(
            JSON.stringify({ call: "transitionState", body: t }) + "\n",
          );
        }
        process.stdout.write(
          JSON.stringify({
            call: "POST /admin/routing",
            body: { service: opts.service, weight: 100 },
          }) + "\n",
        );
        return;
      }
      // 비-dry-run 경로: sim-service-catalog는 in-memory 라이브러리이므로
      // catalog HTTP read/write 엔드포인트가 controller에 추가되어야 force-promote 실제 실행 가능.
      // 본 사이클(Stage 12)은 dry-run 단위 테스트만 범위 — 실제 와이어링은 Stage 13 follow-up.
      process.stderr.write(
        "force-promote 비-dry-run 경로는 catalog HTTP 엔드포인트 미구현 — Stage 13 follow-up에서 와이어링 필요.\n",
      );
      await recordOperatorAction(opts.auditUrl, {
        decisionId,
        operatorAction: true,
        forcedBy: operator,
        actor: operator,
        command: "sim-canary force-promote",
        service: opts.service,
        prefix: opts.prefix,
        transitions: transitions as ReadonlyArray<Record<string, unknown>>,
        reason: opts.reason,
      });
      process.exitCode = 2;
    });

  // -- controller stop: advisory lock release ----------------------------
  const ctrl = cmd.command("controller").description("controller process 제어");
  commonOptions(ctrl.command("stop"))
    .description("controller standby 모드 — advisory lock release")
    .action(async (opts: CommonOpts) => {
      const operator = resolveOperatorIdentity();
      const decisionId = newDecisionId("safety");
      if (opts.dryRun) {
        process.stdout.write(
          JSON.stringify({
            call: "POST /admin/controller/stop",
            target: opts.controllerUrl,
          }) + "\n",
        );
        return;
      }
      const res = await fetch(`${opts.controllerUrl}/admin/controller/stop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: opts.reason }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        process.stderr.write(`controller stop failed ${res.status}\n`);
        process.exitCode = 2;
        return;
      }
      await recordOperatorAction(opts.auditUrl, {
        decisionId,
        operatorAction: true,
        actor: operator,
        command: "sim-canary controller stop",
        service: opts.service,
        prefix: opts.prefix,
        reason: opts.reason,
      });
      process.stdout.write(
        `[OK] controller stop applied (advisory lock released)\n`,
      );
    });

  return cmd;
}

// ESM entry-point check — tsx executes this file via process.argv[1] = absolute path.
import { fileURLToPath } from "node:url";
const isMain =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  buildSimCanary()
    .parseAsync(process.argv)
    .catch((err) => {
      process.stderr.write(
        `sim-canary: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exitCode = 1;
    });
}
