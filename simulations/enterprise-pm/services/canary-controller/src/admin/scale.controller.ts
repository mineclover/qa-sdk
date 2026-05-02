// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 9~11 — admin/scale 3 endpoint + InternalIpGuard (§3).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.8
//
// 3 endpoint:
//   GET  /admin/scale/pin                              → { pins }
//   POST /admin/scale/pin {service, replicas?}         → {service, replicas}
//   POST /admin/scale/replicas {service, replicas, source: "operator"}
//                                                       → {service, prevReplicas, newReplicas}
//
// /admin/scale/replicas 는 docker compose --scale shell out — race 가능성으로
// prevReplicas 는 best-effort. 결정적 PASS 는 e2e 시나리오 quiesce 윈도우 (시나리오 코드
// 책임). 본 endpoint 는 best-effort.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { InternalIpGuard } from "sim-internal-network";
import { ScalePinService } from "./scale-pin.service.js";
import {
  COMPOSE_EXEC_TOKEN,
  SIM_COMPOSE_PROJECT_TOKEN,
  type ComposeExec,
} from "./compose-proxy.controller.js";

const pinBody = z.object({
  service: z.string().min(1),
  replicas: z.number().int().min(1).optional(),
});
const scaleBody = z.object({
  service: z.string().min(1),
  replicas: z.number().int().min(0),
  source: z.literal("operator"),
});

const ERR_VALIDATION = "https://qa-sdk.dev/errors/validation";
const ERR_STORE_FAILURE = "https://qa-sdk.dev/errors/store-failure";

@Controller("admin")
@UseGuards(InternalIpGuard)
export class AdminScaleController {
  constructor(
    @Inject(ScalePinService) private readonly pin: ScalePinService,
    @Inject(COMPOSE_EXEC_TOKEN) private readonly exec: ComposeExec,
    @Inject(SIM_COMPOSE_PROJECT_TOKEN) private readonly project: string,
  ) {}

  @Get("/scale/pin")
  list(): { pins: Record<string, number> } {
    return { pins: this.pin.listPins() };
  }

  @Post("/scale/pin")
  upsert(
    @Body() raw: unknown,
  ): { service: string; replicas: number | null } {
    const parsed = pinBody.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        type: ERR_VALIDATION,
        title: "pin body invalid",
        status: 400,
        detail: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }
    const { service, replicas } = parsed.data;
    if (replicas === undefined) {
      // unpin (replicas 미명시 = pin 해제). idempotent.
      this.pin.unpin(service);
      return { service, replicas: null };
    }
    try {
      this.pin.pin(service, replicas);
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      throw new BadRequestException({
        type: ERR_VALIDATION,
        title: "pin failed",
        status: 400,
        detail: (err as Error).message,
      });
    }
    return { service, replicas };
  }

  @Post("/scale/replicas")
  async scale(
    @Body() raw: unknown,
  ): Promise<{ service: string; prevReplicas: number; newReplicas: number }> {
    const parsed = scaleBody.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        type: ERR_VALIDATION,
        title: "scale body invalid",
        status: 400,
        detail: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }
    const { service, replicas } = parsed.data;
    const prev = await this.probeReplicas(service);
    try {
      await this.exec([
        "compose",
        "-p",
        this.project,
        "up",
        "-d",
        "--no-recreate",
        "--scale",
        `${service}=${replicas}`,
      ]);
    } catch (err) {
      throw new InternalServerErrorException({
        type: ERR_STORE_FAILURE,
        title: "compose --scale failed",
        status: 500,
        detail: (err as Error).message,
      });
    }
    return { service, prevReplicas: prev, newReplicas: replicas };
  }

  /**
   * docker compose ps --format json 출력에서 service running 컨테이너 수를 카운트.
   * compose-proxy.controller 의 parseComposePsOutput 와 동일 로직 — 복제 대신 inline
   * 유지 (compose race 로 인한 best-effort 임을 명시적으로 보존).
   */
  private async probeReplicas(service: string): Promise<number> {
    let result: { stdout: string; stderr: string };
    try {
      result = await this.exec([
        "compose",
        "-p",
        this.project,
        "ps",
        "--format",
        "json",
      ]);
    } catch {
      return 0;
    }
    let count = 0;
    const trimmed = result.stdout.trim();
    if (trimmed.length === 0) return 0;
    for (const line of trimmed.split(/\r?\n/).filter((l) => l.length > 0)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const obj = item as { Service?: unknown; State?: unknown };
        if (obj.Service === service && obj.State === "running") count += 1;
      }
    }
    return count;
  }
}
