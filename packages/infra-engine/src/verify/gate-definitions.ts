// verify/gate-definitions.ts — 내장 게이트 정의
import type { GateCheckResult, DeployContext } from "../core/types.js";
import { httpProbe } from "./health-check.js";

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

  // 3. dependency-reach 게이트
  const deps = ctx.config?.services[ctx.service]?.depends_on ?? [];
  for (const dep of deps) {
    const conn = ctx.config?.connections[dep];
    if (conn?.endpoint) {
      const depHealth = conn.health_path ?? "/health";
      const depResult = await httpProbe(`${conn.endpoint}${depHealth}`, { timeout: 5_000 });
      checks.push({ ...depResult, gate: `dependency-reach:${dep}` });
    }
  }

  return checks;
}
