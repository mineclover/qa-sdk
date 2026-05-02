// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §5 t=5s — gateway routing push + docker compose --scale.
//
// gateway routing push와 compose scale은 서로 다른 부수 효과 채널 — 한쪽 실패가 다른 쪽
// 결정 기록을 무효화하지 않는다. 실패 시 다음 사이클이 같은 결정을 다시 적용 — idempotent.
//
// routing push body: { revision, weight } — gateway는 revision 큰 것만 적용 (spec 01 §6).
// compose scale: target == current 시 no-op.

import { Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { createLogger } from "../lib/logger.js";

interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface ActionConfig {
  gatewayUrl: string;
  composeProject: string;
  /** 테스트 주입 — production은 docker spawn 사용 */
  scaleExec?: (argv: string[]) => Promise<ExecResult>;
}

export type SafetyAction =
  | { kind: "weight-update"; weight: number; revision: number }
  | { kind: "noop" };

export type ResourceAction =
  | { kind: "scale"; target: { v1: number; v2: number }; reason: string }
  | { kind: "noop" };

const dockerExec = (argv: string[]): Promise<ExecResult> =>
  new Promise((resolve, reject) => {
    const p = spawn("docker", argv, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (b) => {
      stdout += String(b);
    });
    p.stderr.on("data", (b) => {
      stderr += String(b);
    });
    p.on("close", (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(new Error(`docker exited ${code}: ${stderr}`)),
    );
  });

@Injectable()
export class ActionExecutorService {
  private readonly logger = createLogger("sim-canary-controller:action");
  private readonly exec: NonNullable<ActionConfig["scaleExec"]>;

  constructor(private readonly cfg: ActionConfig) {
    this.exec = cfg.scaleExec ?? dockerExec;
  }

  async executeSafety(action: SafetyAction): Promise<void> {
    if (action.kind === "noop") return;
    const res = await fetch(`${this.cfg.gatewayUrl}/admin/routing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        revision: action.revision,
        weight: action.weight,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      this.logger.error(
        { status: res.status, weight: action.weight },
        "routing push failed",
      );
      throw new Error(`routing push failed: ${res.status}`);
    }
    this.logger.info(
      { weight: action.weight, revision: action.revision },
      "routing push ok",
    );
  }

  async executeResource(
    action: ResourceAction,
    current: { v1: number; v2: number },
  ): Promise<void> {
    if (action.kind === "noop") return;
    if (
      action.target.v1 === current.v1 &&
      action.target.v2 === current.v2
    ) {
      this.logger.debug({ target: action.target }, "scale no-op");
      return;
    }
    const argv = (svc: string, n: number) => [
      "compose",
      "-p",
      this.cfg.composeProject,
      "up",
      "-d",
      "--no-recreate",
      "--scale",
      `${svc}=${n}`,
    ];
    if (action.target.v1 !== current.v1) {
      await this.exec(argv("sim-approval-api-v1", action.target.v1));
    }
    if (action.target.v2 !== current.v2) {
      await this.exec(argv("sim-approval-api-v2", action.target.v2));
    }
    this.logger.info(
      { target: action.target, reason: action.reason },
      "compose scale ok",
    );
  }
}
