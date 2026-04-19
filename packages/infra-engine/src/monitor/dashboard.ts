// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// monitor/dashboard.ts — 인프라 대시보드 데이터 API
import type { InfraProfileAdapter } from "../adapters/adapter.js";
import type { DeployHistoryEntry, SyncStatus } from "../core/types.js";

export interface DashboardSummary {
  timestamp: string;
  totalServices: number;
  deployed: number;
  monitored: number;
  byStatus: Record<SyncStatus, number>;
  byProvider: Record<string, number>;
  byEnv: Record<string, number>;
}

export interface ServiceDashboard {
  serviceId: string;
  deployment?: {
    provider: string;
    env: string;
    region: string;
    endpoint: string;
    deployedAt: string;
  };
  monitor?: {
    status: SyncStatus;
    lastChecked: string;
    interval: number;
  };
  history: DeployHistoryEntry[];
  uptime?: {
    since: string;
    durationMs: number;
    percentage: number; // 0-100
  };
}

export interface DashboardData {
  getSummary(): Promise<DashboardSummary>;
  getServiceDashboard(serviceId: string): Promise<ServiceDashboard>;
  exportJson(): Promise<string>;
}

export function createDashboardData(infraProfile: InfraProfileAdapter): DashboardData {
  return {
    async getSummary() {
      const deployments = await infraProfile.getAllDeployments();
      const monitors = await infraProfile.getAllMonitors();

      const byStatus: Record<string, number> = { Synced: 0, OutOfSync: 0, Degraded: 0, Unknown: 0 };
      const byProvider: Record<string, number> = {};
      const byEnv: Record<string, number> = {};

      for (const m of monitors) {
        const status = m.lastStatus ?? "Unknown";
        byStatus[status] = (byStatus[status] ?? 0) + 1;
      }

      for (const d of Object.values(deployments)) {
        byProvider[d.provider] = (byProvider[d.provider] ?? 0) + 1;
        byEnv[d.env] = (byEnv[d.env] ?? 0) + 1;
      }

      return {
        timestamp: new Date().toISOString(),
        totalServices: Object.keys(deployments).length,
        deployed: Object.keys(deployments).length,
        monitored: monitors.length,
        byStatus: byStatus as Record<SyncStatus, number>,
        byProvider,
        byEnv,
      };
    },

    async getServiceDashboard(serviceId) {
      const dep = await infraProfile.getDeployment(serviceId);
      const monitors = await infraProfile.getAllMonitors();
      const monitor = monitors.find((m) => m.serviceId === serviceId);
      const history = await infraProfile.getHistory(serviceId);

      // 가동 시간 계산
      let uptime: ServiceDashboard["uptime"];
      if (history.length > 0) {
        const lastSuccess = history.find((h) => h.success);
        if (lastSuccess) {
          const since = lastSuccess.deployedAt;
          const durationMs = Date.now() - new Date(since).getTime();
          const firstDeploy = history[history.length - 1].deployedAt;
          const totalMs = Date.now() - new Date(firstDeploy).getTime();
          uptime = {
            since,
            durationMs,
            percentage: totalMs > 0 ? Math.round((durationMs / totalMs) * 100) : 100,
          };
        }
      }

      return {
        serviceId,
        deployment: dep
          ? {
              provider: dep.provider,
              env: dep.env,
              region: dep.region,
              endpoint: dep.endpoint,
              deployedAt: dep.deployedAt,
            }
          : undefined,
        monitor: monitor
          ? {
              status: monitor.lastStatus ?? "Unknown",
              lastChecked: monitor.lastChecked ?? "never",
              interval: monitor.interval,
            }
          : undefined,
        history,
        uptime,
      };
    },

    async exportJson() {
      const summary = await this.getSummary();
      const deployments = await infraProfile.getAllDeployments();
      const serviceIds = Object.keys(deployments);
      const services: Record<string, ServiceDashboard> = {};
      for (const id of serviceIds) {
        services[id] = await this.getServiceDashboard(id);
      }
      return JSON.stringify({ summary, services }, null, 2);
    },
  };
}
