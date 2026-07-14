// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 8 — GET /admin/compose/replicas + InternalIpGuard (§3).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.6
//
// docker compose ps --format json 결과를 service 별 running 컨테이너 수로 집계한다.
// service 목록 hardcode 금지 — compose 실제 출력에서 동적 수집.
// Compose v2.20+ 줄별 JSON object, v2.18 이하 단일 array 양쪽 호환.

import { Controller, Get, Inject, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { InternalIpGuard } from 'sim-internal-network';

/**
 * docker exec port — 테스트는 mock 주입, production 은 dockerComposeExec 기본 구현.
 * argv 는 `compose`, `-p`, project, `ps`, `--format`, `json` 등 docker subcommand.
 */
export type ComposeExec = (argv: string[]) => Promise<{ stdout: string; stderr: string }>;

export const COMPOSE_EXEC_TOKEN = Symbol('ComposeExec');
export const SIM_COMPOSE_PROJECT_TOKEN = Symbol('SIM_COMPOSE_PROJECT');

@Controller('admin')
@UseGuards(InternalIpGuard)
export class AdminComposeProxyController {
  constructor(
    @Inject(COMPOSE_EXEC_TOKEN) private readonly exec: ComposeExec,
    @Inject(SIM_COMPOSE_PROJECT_TOKEN) private readonly project: string,
  ) {}

  @Get('/compose/replicas')
  async replicas(): Promise<{ services: Record<string, number> }> {
    let result: { stdout: string; stderr: string };
    try {
      result = await this.exec(['compose', '-p', this.project, 'ps', '--format', 'json']);
    } catch (err) {
      throw new InternalServerErrorException({
        type: 'https://qa-sdk.dev/errors/store-failure',
        title: 'compose ps failed',
        status: 500,
        detail: (err as Error).message,
      });
    }

    return { services: parseComposePsOutput(result.stdout) };
  }
}

/**
 * Compose v2.20+ (line-delimited JSON object) + v2.18 이하 (단일 array) 양쪽 호환.
 * - state 가 "running" 인 항목만 카운트 (exited/restarting 제외).
 * - JSON 파싱 실패 줄은 skip — 결정적 경로 보장 (외부 출력 에러 격리).
 */
function parseComposePsOutput(stdout: string): Record<string, number> {
  const services: Record<string, number> = {};
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return services;

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
      if (typeof obj.Service !== 'string' || obj.State !== 'running') continue;
      services[obj.Service] = (services[obj.Service] ?? 0) + 1;
    }
  }
  return services;
}
