// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// monitor/sync-loop.ts — 서비스 헬스 체크 주기 실행
import type { InfraProfileAdapter, IngestAdapter } from "../adapters/adapter.js";
import type { MonitorTarget, SyncStatus } from "../core/types.js";

export interface SyncLoopOptions {
  infraProfile: InfraProfileAdapter;
  ingest?: IngestAdapter;
  webhooks?: Array<{ url: string; events: string[] }>;
  interval?: number; // seconds, default 60
  onStatusChange?: (serviceId: string, prev: SyncStatus, curr: SyncStatus) => void;
}

export interface SyncCheckResult {
  serviceId: string;
  previousStatus: SyncStatus;
  currentStatus: SyncStatus;
  changed: boolean;
  checkedAt: string;
  latency?: number;
  detail: string;
}

export function createSyncLoop(options: SyncLoopOptions) {
  const interval = (options.interval ?? 60) * 1000;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastResults: SyncCheckResult[] = [];

  async function checkOne(target: MonitorTarget): Promise<SyncCheckResult> {
    const checkedAt = new Date().toISOString();
    const prev = target.lastStatus ?? "Unknown";

    try {
      const start = Date.now();
      const healthUrl = `${target.endpoint}${target.healthPath}`;
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
      const latency = Date.now() - start;

      let current: SyncStatus;
      if (res.ok) {
        current = "Synced";
      } else if (res.status >= 500) {
        current = "OutOfSync";
      } else {
        current = "Degraded";
      }

      return {
        serviceId: target.serviceId,
        previousStatus: prev,
        currentStatus: current,
        changed: prev !== current,
        checkedAt,
        latency,
        detail: `${res.status}`,
      };
    } catch (err) {
      return {
        serviceId: target.serviceId,
        previousStatus: prev,
        currentStatus: "Unknown",
        changed: prev !== "Unknown",
        checkedAt,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function syncAll(): Promise<SyncCheckResult[]> {
    const monitors = await options.infraProfile.getAllMonitors();
    if (monitors.length === 0) return [];

    const results = await Promise.all(monitors.map(checkOne));

    // 프로필 상태 업데이트 + 변경 알림
    for (const r of results) {
      await options.infraProfile.updateMonitorStatus(r.serviceId, r.currentStatus, r.checkedAt);

      if (r.changed) {
        // 콜백
        options.onStatusChange?.(r.serviceId, r.previousStatus, r.currentStatus);

        // 웹훅 전송
        if (options.webhooks) {
          for (const wh of options.webhooks) {
            if (wh.events.includes(r.currentStatus)) {
              try {
                await fetch(wh.url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: `[infra-engine] ${r.serviceId}: ${r.previousStatus} -> ${r.currentStatus}`,
                    service: r.serviceId,
                    from: r.previousStatus,
                    to: r.currentStatus,
                    checkedAt: r.checkedAt,
                    detail: r.detail,
                  }),
                  signal: AbortSignal.timeout(5_000),
                });
              } catch {
                /* webhook 실패는 무시 (fail-open) */
              }
            }
          }
        }

        // Ingest emit (fail-open)
        if (options.ingest) {
          try {
            await options.ingest.emit(
              "health_event",
              {
                service_id: r.serviceId,
                previous_status: r.previousStatus,
                current_status: r.currentStatus,
                latency_ms: r.latency,
              },
              {},
            );
          } catch {
            /* fail-open */
          }
        }
      }
    }

    lastResults = results;
    return results;
  }

  return {
    start() {
      if (timer) return;
      console.log(`[sync-loop] 시작 (간격: ${interval / 1000}초)`);
      // 즉시 1회 실행 + 주기적
      syncAll().catch(() => {});
      timer = setInterval(() => {
        syncAll().catch(() => {});
      }, interval);
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        console.log("[sync-loop] 중지");
      }
    },

    isRunning() {
      return timer !== null;
    },

    /** 수동 전체 동기화 */
    syncAll,

    /** 마지막 체크 결과 */
    getLastResults() {
      return lastResults;
    },
  };
}
