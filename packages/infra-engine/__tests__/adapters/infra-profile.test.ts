import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInfraProfileAdapter } from '../../src/adapters/infra-profile.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  DeployHistoryEntry,
  InfraDeploymentEntry,
  MonitorTarget,
} from '../../src/core/types.js';

const entry: InfraDeploymentEntry = {
  serviceId: 'test-svc',
  provider: 'local',
  env: 'dev',
  region: 'local',
  endpoint: 'http://localhost:3200',
  healthPath: '/health',
  stackName: 'test-svc-dev-local-local',
  deploymentVersion: 'abc123',
  deployedAt: '2026-04-05T00:00:00Z',
  triggeredBy: 'manual',
  metadata: {},
};

describe('InfraProfileAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'infra-profile-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('setDeployment + getDeployment 라운드트립', async () => {
    const adapter = createInfraProfileAdapter(dir);
    await adapter.setDeployment('test-svc', entry);
    const result = await adapter.getDeployment('test-svc');
    expect(result).toEqual(entry);
  });

  it('존재하지 않는 서비스 → null', async () => {
    const adapter = createInfraProfileAdapter(dir);
    expect(await adapter.getDeployment('nope')).toBeNull();
  });

  it('restore — 이전 값 복원', async () => {
    const adapter = createInfraProfileAdapter(dir);
    await adapter.setDeployment('test-svc', entry);
    await adapter.setDeployment('test-svc', { ...entry, endpoint: 'http://new:3200' });
    await adapter.restore('test-svc');
    const result = await adapter.getDeployment('test-svc');
    expect(result?.endpoint).toBe('http://localhost:3200');
  });

  it('addHistory + getHistory 라운드트립', async () => {
    const adapter = createInfraProfileAdapter(dir);
    const historyEntry: DeployHistoryEntry = {
      deployedAt: '2026-04-05T00:00:00Z',
      version: 'abc123',
      env: 'dev',
      provider: 'local',
      endpoint: 'http://localhost:3200',
      duration: 1500,
      success: true,
      triggeredBy: 'manual',
    };
    await adapter.addHistory('test-svc', historyEntry);
    const history = await adapter.getHistory('test-svc');
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(historyEntry);
    const allHistory = await adapter.getAllHistory();
    expect(allHistory['test-svc']).toEqual([historyEntry]);
  });

  it('getHistory — 존재하지 않는 서비스 → 빈 배열', async () => {
    const adapter = createInfraProfileAdapter(dir);
    expect(await adapter.getHistory('nope')).toEqual([]);
  });

  it('addHistory — 50건 초과 시 가장 오래된 항목 제거', async () => {
    const adapter = createInfraProfileAdapter(dir);
    for (let i = 0; i < 55; i++) {
      await adapter.addHistory('test-svc', {
        deployedAt: `2026-04-05T00:${String(i).padStart(2, '0')}:00Z`,
        version: `v${i}`,
        env: 'dev',
        provider: 'local',
        endpoint: 'http://localhost:3200',
        duration: 100,
        success: true,
        triggeredBy: 'manual',
      });
    }
    const history = await adapter.getHistory('test-svc');
    expect(history).toHaveLength(50);
    // 가장 오래된 5개 (v0~v4) 제거, v5부터 시작
    expect(history[0].version).toBe('v5');
    expect(history[49].version).toBe('v54');
  });

  it('모니터 등록 + 조회', async () => {
    const adapter = createInfraProfileAdapter(dir);
    const target: MonitorTarget = {
      serviceId: 'test-svc',
      endpoint: 'http://localhost:3200',
      healthPath: '/health',
      provider: 'local',
      env: 'dev',
      region: 'local',
      namespace: 'shop',
      interval: 60,
    };
    await adapter.setMonitor('test-svc', target);
    const all = await adapter.getAllMonitors();
    expect(all).toHaveLength(1);
    expect(all[0].serviceId).toBe('test-svc');
  });
});
