// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// verify/gate-definitions.ts — 내장 게이트 정의
import type { GateCheckResult, DeployContext } from '../core/types.js';
import type { ServiceProfileAdapter } from '../adapters/adapter.js';
import { httpProbe } from './health-check.js';

/** 원격(배포된) 엔드포인트인지 판단. localhost/127.0.0.1은 로컬 서비스 */
function isRemoteEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '0.0.0.0';
  } catch {
    return false;
  }
}

/**
 * dependency endpoint resolve 체인:
 * 1. config.connections[dep].endpoint (유저 지정 DNS 우선)
 * 2. service-profile[dep] (이전 배포에서 수집된 URL)
 * 3. null (엔드포인트 없음)
 */
async function resolveDepEndpoint(
  dep: string,
  ctx: DeployContext,
  profile?: ServiceProfileAdapter,
): Promise<{ endpoint: string | null; source: 'config' | 'profile' | 'none'; healthPath: string }> {
  const conn = ctx.config?.connections[dep];
  const healthPath = conn?.health_path ?? '/health';
  if (conn?.endpoint) {
    return { endpoint: conn.endpoint, source: 'config', healthPath };
  }
  if (profile) {
    const profileUrl = await profile.get(dep).catch(() => null);
    if (profileUrl) {
      return { endpoint: profileUrl, source: 'profile', healthPath };
    }
  }
  return { endpoint: null, source: 'none', healthPath };
}

export interface GateOptions {
  /** service-profile을 통한 endpoint 피드백 루프 */
  serviceProfile?: ServiceProfileAdapter;
}

export async function runBuiltinGates(
  ctx: DeployContext,
  options?: GateOptions,
): Promise<GateCheckResult[]> {
  const endpoint = ctx.provision!.outputs.endpoint;
  const healthPath = ctx.config?.connections[ctx.service]?.health_path ?? '/health';
  const checks: GateCheckResult[] = [];

  // 1. health-endpoint 게이트
  const healthResult = await httpProbe(`${endpoint}${healthPath}`);
  checks.push({ ...healthResult, gate: 'health-endpoint' });

  // 2. response-time 게이트
  if (healthResult.latency != null) {
    const verdict =
      healthResult.latency > 10_000 ? 'fail' : healthResult.latency > 2_000 ? 'warn' : 'pass';
    checks.push({
      gate: 'response-time',
      verdict,
      detail: `${healthResult.latency}ms`,
      latency: healthResult.latency,
    });
  }

  // 3. dependency-reach 게이트 — endpoint resolve 체인 + 원격만 체크
  const deps = ctx.config?.services[ctx.service]?.depends_on ?? [];
  for (const dep of deps) {
    const resolved = await resolveDepEndpoint(dep, ctx, options?.serviceProfile);

    if (!resolved.endpoint) {
      // endpoint를 어디서도 찾을 수 없음 — 미배포 서비스
      checks.push({
        gate: `dependency-reach:${dep}`,
        verdict: 'pass',
        detail: `스킵 (엔드포인트 미등록)`,
      });
      continue;
    }

    if (!isRemoteEndpoint(resolved.endpoint)) {
      // 로컬 서비스는 CF Workers 배포에서 도달 불가 — 스킵
      checks.push({
        gate: `dependency-reach:${dep}`,
        verdict: 'pass',
        detail: `스킵 (로컬: ${resolved.endpoint})`,
      });
      continue;
    }

    const depResult = await httpProbe(`${resolved.endpoint}${resolved.healthPath}`, {
      timeout: 5_000,
    });
    // 의존 서비스 도달 실패는 warn으로 처리 — 배포 자체를 실패시키지 않는다
    if (depResult.verdict === 'fail') {
      depResult.verdict = 'warn';
      depResult.detail = `도달 불가 (warn): ${depResult.detail}`;
    }
    const sourceTag = resolved.source === 'profile' ? ' [profile]' : '';
    checks.push({ ...depResult, gate: `dependency-reach:${dep}${sourceTag}` });
  }

  return checks;
}
