// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §5 t=5s — gateway routing push + docker compose --scale.
// spec 2026-05-02 §7 (#21) — ActionExecutor 가 gateway RoutingPushSchema 형태로 변환.
//
// gateway routing push 와 compose scale 은 서로 다른 부수 효과 채널 — 한쪽 실패가 다른 쪽
// 결정 기록을 무효화하지 않는다. 실패 시 다음 사이클이 같은 결정을 다시 적용 — idempotent.
//
// routing push body: gateway RoutingPushSchema 정합 (services.<name>.{revision, stable,
// candidate, weight, stickyKey}). gateway 는 revision 큰 것만 적용 (spec 02 §6).
// compose scale: target == current 시 no-op.

import { Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { buildVersionTag, type VersionTag } from "sim-identifier-grammar";
import type { RoutingPush } from "@qa-sdk/sim-gateway/routing";
import { createLogger } from "../lib/logger.js";
import type { ScalePinService } from "../admin/scale-pin.service.js";
import type { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";

interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * sim-service-catalog wrapper port — async lookup 을 가정 (controller 가 catalog HTTP
 * endpoint 또는 메모리 lookup 을 wrap). 응답 shape 은 spec §6 + §7 일치.
 */
export interface SimServiceCatalogPort {
  getCurrentTopology(prefix: string): Promise<{
    stable: { value: number };
    candidate: { value: number } | null;
    retired: { value: number }[];
  }>;
}

/**
 * portRegistry — service container 이름 → upstream URL.
 * 시뮬에서는 docker-compose 서비스 이름 + 4600 포트 합성.
 */
export interface PortRegistryPort {
  getUpstream(serviceContainer: string): string;
}

export interface ActionConfig {
  gatewayUrl: string;
  composeProject: string;
  /** spec §7 — controller 가 routing push 시 대상 서비스 이름 (예: "approval"). */
  serviceName: string;
  catalog: SimServiceCatalogPort;
  portRegistry: PortRegistryPort;
  /**
   * spec §6 + Task 1b.10 — pin 활성화 service 에 대해 compose 호출 SKIP + alert 발행.
   * 부재 시 pin 검사 비활성 (production 은 AppModule 에서 항상 wire).
   */
  pin?: ScalePinService;
  ring?: DecisionRingBuffer;
  /** 테스트 주입 — production 은 docker spawn 사용. */
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

  /**
   * spec §7 #21 — RoutingPushSchema 정합 body 합성.
   * - catalog `getCurrentTopology` 로 stable/candidate 버전 조회.
   * - portRegistry 로 각 버전의 service container upstream URL 합성.
   * - gateway POST /admin/routing 에 1 회 push.
   *
   * weight-update 가 아니면 (noop) → 외부 호출 없이 return.
   */
  async executeSafety(action: SafetyAction): Promise<void> {
    if (action.kind === "noop") return;

    const { weight, revision } = action;
    const { serviceName, catalog, portRegistry } = this.cfg;
    const topology = await catalog.getCurrentTopology(`sim.svc.${serviceName}`);

    const stableTag: VersionTag = {
      axis: "version",
      value: topology.stable.value,
      state: "stable",
    };
    const stableUpstream = portRegistry.getUpstream(
      `sim-${serviceName}-v${topology.stable.value}`,
    );

    const candidate = topology.candidate;
    const candidatePair =
      candidate === null
        ? null
        : {
            version: buildVersionTag({
              axis: "version",
              value: candidate.value,
              state: "candidate",
            }),
            upstream: portRegistry.getUpstream(
              `sim-${serviceName}-v${candidate.value}`,
            ),
          };

    const body: RoutingPush = {
      services: {
        [serviceName]: {
          revision,
          stable: {
            version: buildVersionTag(stableTag),
            upstream: stableUpstream,
          },
          candidate: candidatePair,
          weight,
          stickyKey: "user_id",
        },
      },
    };

    const res = await fetch(`${this.cfg.gatewayUrl}/admin/routing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      this.logger.error(
        { status: res.status, weight, revision, serviceName },
        "routing push failed",
      );
      throw new Error(`routing push failed: ${res.status}`);
    }
    this.logger.info(
      { weight, revision, serviceName },
      "routing push ok (RoutingPushSchema)",
    );
  }

  /**
   * spec §6 + Task 1b.10 — scale 실행 전 pin 검사.
   * - pin 이 set 된 service 는 compose --scale 호출 SKIP + ring 에
   *   `scale-up-rejected` alert 발행.
   * - 다른 service 는 정상 진행.
   * - pin/ring 이 cfg 에 없으면 검사 비활성 (단위 테스트 backward compat).
   */
  async executeResource(
    action: ResourceAction,
    current: { v1: number; v2: number },
    ctx: { cycleId: string },
  ): Promise<void> {
    if (action.kind === "noop") return;
    if (action.target.v1 === current.v1 && action.target.v2 === current.v2) {
      this.logger.debug({ target: action.target }, "scale no-op");
      return;
    }

    const apply = async (
      service: string,
      currentN: number,
      targetN: number,
    ): Promise<void> => {
      if (currentN === targetN) return;
      const pinned = this.cfg.pin?.getPin(service);
      if (pinned !== undefined && pinned !== null) {
        // compose --scale SKIP — alert 1 건만 ring 에 추가.
        this.cfg.ring?.appendAlert({
          cycleId: ctx.cycleId,
          kind: "scale-up-rejected",
          occurredAt: new Date().toISOString(),
          details: {
            reason: "pin-active",
            service,
            pinnedReplicas: pinned,
            attemptedReplicas: targetN,
          },
        });
        this.logger.info(
          { service, pinned, attempted: targetN, cycleId: ctx.cycleId },
          "scale skipped — pin active",
        );
        return;
      }
      await this.exec([
        "compose",
        "-p",
        this.cfg.composeProject,
        "up",
        "-d",
        "--no-recreate",
        "--scale",
        `${service}=${targetN}`,
      ]);
    };

    await apply("sim-approval-api-v1", current.v1, action.target.v1);
    await apply("sim-approval-api-v2", current.v2, action.target.v2);

    this.logger.info(
      { target: action.target, reason: action.reason, cycleId: ctx.cycleId },
      "compose scale ok (pin-aware)",
    );
  }
}
