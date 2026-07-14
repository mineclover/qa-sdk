// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// verify/health-check.ts — HTTP 헬스체크 프로브
import type { GateCheckResult } from '../core/types.js';

export async function httpProbe(
  url: string,
  options?: { timeout?: number },
): Promise<GateCheckResult> {
  const timeout = options?.timeout ?? 10_000;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    const latency = Date.now() - start;
    if (res.ok) {
      return { gate: 'http-probe', verdict: 'pass', detail: `${res.status}`, latency };
    }
    return { gate: 'http-probe', verdict: 'fail', detail: `status ${res.status}`, latency };
  } catch (err) {
    return {
      gate: 'http-probe',
      verdict: 'fail',
      detail: err instanceof Error ? err.message : String(err),
      latency: Date.now() - start,
    };
  }
}
