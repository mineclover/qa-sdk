// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// adapters/service-profile.ts — 서비스 프로필 JSON 파일 기반 어댑터
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServiceProfileAdapter } from './adapter.js';

const PROFILE = 'service-profile.json';
const ROLLBACK = 'service-profile.rollback.json';

interface ProfileData {
  mode: string;
  insightsDriver: string;
  services: Record<string, string>;
  [key: string]: unknown;
}

export function createServiceProfileAdapter(baseDir: string): ServiceProfileAdapter {
  const profilePath = join(baseDir, PROFILE);
  const rollbackPath = join(baseDir, ROLLBACK);

  async function load(): Promise<ProfileData> {
    try {
      return JSON.parse(await readFile(profilePath, 'utf-8'));
    } catch {
      return { mode: 'local', insightsDriver: 'local', services: {} };
    }
  }

  async function save(data: ProfileData): Promise<void> {
    await mkdir(baseDir, { recursive: true });
    const tmp = profilePath + '.tmp';
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, profilePath);
  }

  return {
    async get(serviceId) {
      const data = await load();
      return data.services[serviceId] ?? null;
    },
    async set(serviceId, url) {
      const data = await load();
      // rollback 백업 (원자적 쓰기)
      const tmp = rollbackPath + '.tmp';
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, rollbackPath);
      data.services[serviceId] = url;
      await save(data);
    },
    async restore(serviceId) {
      try {
        const rollback: ProfileData = JSON.parse(await readFile(rollbackPath, 'utf-8'));
        const current = await load();
        current.services[serviceId] = rollback.services[serviceId] ?? current.services[serviceId];
        await save(current);
      } catch {
        // rollback 파일 없으면 무시
      }
    },
  };
}
