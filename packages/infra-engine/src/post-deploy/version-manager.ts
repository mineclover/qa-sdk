// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";

const VERSION_FILE = resolve(homedir(), ".qa-sdk", "infra-versions.json");

export interface ServiceVersion {
  serviceId: string;
  currentVersion: string;
  previousVersion?: string;
  env: string;
  provider: string;
  endpoint: string;
  deployedAt: string;
  history: Array<{ version: string; deployedAt: string; rollbackFrom?: string }>;
}

export interface VersionStore {
  getVersion(serviceId: string, env: string): Promise<ServiceVersion | null>;
  setVersion(serviceId: string, env: string, version: string, endpoint: string, provider: string): Promise<ServiceVersion>;
  listVersions(env?: string): Promise<ServiceVersion[]>;
  rollback(serviceId: string, env: string): Promise<ServiceVersion | null>;
}

export function createVersionStore(): VersionStore {
  async function load(): Promise<Record<string, ServiceVersion>> {
    try { return JSON.parse(await readFile(VERSION_FILE, "utf-8")); } catch { return {}; }
  }

  async function save(data: Record<string, ServiceVersion>): Promise<void> {
    await mkdir(resolve(homedir(), ".qa-sdk"), { recursive: true });
    const tmp = VERSION_FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, VERSION_FILE);
  }

  return {
    async getVersion(serviceId, env) {
      const data = await load();
      return data[`${serviceId}@${env}`] ?? null;
    },

    async setVersion(serviceId, env, version, endpoint, provider) {
      const data = await load();
      const key = `${serviceId}@${env}`;
      const prev = data[key];
      const now = new Date().toISOString();
      const entry: ServiceVersion = {
        serviceId,
        currentVersion: version,
        previousVersion: prev?.currentVersion,
        env,
        provider,
        endpoint,
        deployedAt: now,
        history: [
          ...(prev?.history ?? []).slice(-19), // 최대 20건
          { version, deployedAt: now },
        ],
      };
      data[key] = entry;
      await save(data);
      return entry;
    },

    async listVersions(env) {
      const data = await load();
      const all = Object.values(data);
      return env ? all.filter(v => v.env === env) : all;
    },

    async rollback(serviceId, env) {
      const data = await load();
      const key = `${serviceId}@${env}`;
      const current = data[key];
      if (!current?.previousVersion) return null;

      const now = new Date().toISOString();
      const entry: ServiceVersion = {
        ...current,
        currentVersion: current.previousVersion,
        previousVersion: current.currentVersion,
        deployedAt: now,
        history: [
          ...current.history.slice(-19),
          { version: current.previousVersion, deployedAt: now, rollbackFrom: current.currentVersion },
        ],
      };
      data[key] = entry;
      await save(data);
      return entry;
    },
  };
}
