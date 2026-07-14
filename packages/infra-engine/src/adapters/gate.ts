// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// adapters/gate.ts — 게이트 판정 어댑터
import type { GateCheckResult, GateVerdict } from '../core/types.js';
import type { GateAdapter } from './adapter.js';

export function createGateAdapter(): GateAdapter {
  return {
    evaluate(checks: GateCheckResult[]): GateVerdict {
      if (checks.some((c) => c.verdict === 'fail')) return 'fail';
      if (checks.some((c) => c.verdict === 'warn')) return 'warn';
      return 'pass';
    },
  };
}
