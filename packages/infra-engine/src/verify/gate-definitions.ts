// verify/gate-definitions.ts — 내장 게이트 정의
import type { GateCheckResult, DeployContext } from "../core/types.js";
import { httpProbe } from "./health-check.js";

/** 원격(배포된) 엔드포인트인지 판단. localhost/127.0.0.1은 로컬 서비스 */
function isRemoteEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "0.0.0.0";
  } catch {
    return false;
  }
}

export async function runBuiltinGates(ctx: DeployContext): Promise<GateCheckResult[]> {
  const endpoint = ctx.provision!.outputs.endpoint;
  const healthPath = ctx.config?.connections[ctx.service]?.health_path ?? "/health";
  const checks: GateCheckResult[] = [];

  // 1. health-endpoint 게이트
  const healthResult = await httpProbe(`${endpoint}${healthPath}`);
  checks.push({ ...healthResult, gate: "health-endpoint" });

  // 2. response-time 게이트
  if (healthResult.latency != null) {
    const verdict = healthResult.latency > 10_000 ? "fail" : healthResult.latency > 2_000 ? "warn" : "pass";
    checks.push({
      gate: "response-time",
      verdict,
      detail: `${healthResult.latency}ms`,
      latency: healthResult.latency,
    });
  }

  // 3. dependency-reach 게이트 — 원격 엔드포인트만 체크
  const deps = ctx.config?.services[ctx.service]?.depends_on ?? [];
  for (const dep of deps) {
    const conn = ctx.config?.connections[dep];
    if (conn?.endpoint) {
      if (!isRemoteEndpoint(conn.endpoint)) {
        // 로컬 서비스는 CF Workers 배포에서 도달 불가 — 스킵
        checks.push({
          gate: `dependency-reach:${dep}`,
          verdict: "pass",
          detail: `스킵 (로컬 엔드포인트: ${conn.endpoint})`,
        });
        continue;
      }
      const depHealth = conn.health_path ?? "/health";
      const depResult = await httpProbe(`${conn.endpoint}${depHealth}`, { timeout: 5_000 });
      // 의존 서비스 도달 실패는 warn으로 처리 — 배포 자체를 실패시키지 않는다
      if (depResult.verdict === "fail") {
        depResult.verdict = "warn";
        depResult.detail = `도달 불가 (warn 처리): ${depResult.detail}`;
      }
      checks.push({ ...depResult, gate: `dependency-reach:${dep}` });
    }
  }

  return checks;
}
