// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// monitor/auto-recovery.ts — 자동 복구 + 에스컬레이션
import type { SyncCheckResult } from "./sync-loop.js";

export interface AutoRecoveryOptions {
  maxRetries: number; // default 3
  cooldownMs: number; // default 300_000 (5min)
  onTrigger: (serviceId: string, attempt: number) => Promise<boolean>; // true = 복구 성공
  onEscalate: (serviceId: string, attempts: number) => void;
}

interface RecoveryState {
  attempts: number;
  lastAttempt: number; // timestamp
}

export function createAutoRecovery(options: AutoRecoveryOptions) {
  const state = new Map<string, RecoveryState>();

  return {
    async evaluate(results: SyncCheckResult[]): Promise<void> {
      for (const r of results) {
        if (r.currentStatus === "Synced") {
          // 정상 복구 → 상태 리셋
          state.delete(r.serviceId);
          continue;
        }

        if (r.currentStatus === "OutOfSync" || r.currentStatus === "Unknown") {
          const s = state.get(r.serviceId) ?? { attempts: 0, lastAttempt: 0 };

          // 쿨다운 확인
          if (Date.now() - s.lastAttempt < options.cooldownMs) continue;

          if (s.attempts >= options.maxRetries) {
            options.onEscalate(r.serviceId, s.attempts);
            continue;
          }

          s.attempts++;
          s.lastAttempt = Date.now();
          state.set(r.serviceId, s);

          const success = await options.onTrigger(r.serviceId, s.attempts);
          if (success) {
            state.delete(r.serviceId);
          }
        }
      }
    },

    getState() {
      return new Map(state);
    },
    reset(serviceId: string) {
      state.delete(serviceId);
    },
    resetAll() {
      state.clear();
    },
  };
}
