// adapters/infra-profile.ts — 인프라 프로필 JSON 파일 기반 어댑터
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { InfraProfileAdapter } from "./adapter.js";
import type { InfraDeploymentEntry, MonitorTarget } from "../core/types.js";

interface InfraProfileData {
  deployments: Record<string, InfraDeploymentEntry>;
  monitors: MonitorTarget[];
}

const PROFILE_FILE = "infra-profile.json";
const ROLLBACK_FILE = "infra-profile.rollback.json";

export function createInfraProfileAdapter(baseDir: string): InfraProfileAdapter {
  const profilePath = join(baseDir, PROFILE_FILE);
  const rollbackPath = join(baseDir, ROLLBACK_FILE);

  async function load(): Promise<InfraProfileData> {
    try {
      const raw = await readFile(profilePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { deployments: {}, monitors: [] };
    }
  }

  async function save(data: InfraProfileData): Promise<void> {
    await mkdir(baseDir, { recursive: true });
    await writeFile(profilePath, JSON.stringify(data, null, 2));
  }

  async function saveRollback(data: InfraProfileData): Promise<void> {
    await mkdir(baseDir, { recursive: true });
    await writeFile(rollbackPath, JSON.stringify(data, null, 2));
  }

  async function loadRollback(): Promise<InfraProfileData> {
    try {
      const raw = await readFile(rollbackPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { deployments: {}, monitors: [] };
    }
  }

  return {
    async setDeployment(serviceId, entry) {
      const data = await load();
      await saveRollback(data); // 이전 상태 백업
      data.deployments[serviceId] = entry;
      await save(data);
    },
    async getDeployment(serviceId) {
      const data = await load();
      return data.deployments[serviceId] ?? null;
    },
    async getAllDeployments() {
      const data = await load();
      return data.deployments;
    },
    async restore(serviceId) {
      const rollback = await loadRollback();
      const current = await load();
      if (rollback.deployments[serviceId]) {
        current.deployments[serviceId] = rollback.deployments[serviceId];
      } else {
        delete current.deployments[serviceId];
      }
      await save(current);
    },
    async setMonitor(serviceId, target) {
      const data = await load();
      data.monitors = data.monitors.filter((m) => m.serviceId !== serviceId);
      data.monitors.push(target);
      await save(data);
    },
    async removeMonitor(serviceId) {
      const data = await load();
      data.monitors = data.monitors.filter((m) => m.serviceId !== serviceId);
      await save(data);
    },
    async getAllMonitors() {
      const data = await load();
      return data.monitors;
    },
    async updateMonitorStatus(serviceId, status, checkedAt) {
      const data = await load();
      const target = data.monitors.find((m) => m.serviceId === serviceId);
      if (target) {
        target.lastStatus = status as MonitorTarget["lastStatus"];
        target.lastChecked = checkedAt;
        await save(data);
      }
    },
  };
}
