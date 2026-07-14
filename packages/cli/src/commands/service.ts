// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk service — 서비스 토폴로지 조회 + 환경 프로필 관리 CLI.
 *
 * 서비스 URL은 ~/.qa-sdk/service-profile.json에서 중앙 관리한다.
 * `qa-sdk service mode local|staging|prod`로 전환하면 모든 CLI 명령의 URL이 함께 변경된다.
 */

import {
  loadProfile,
  saveProfile,
  getServiceUrl,
  getProfilePath,
  PROFILE_PRESETS,
  SERVICE_IDS,
  type ServiceProfile,
  type ServiceMode,
} from '../lib/service-profile.js';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getRegistryUrl(args: string[]): string {
  const idx = args.indexOf('--registry');
  const override = idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  return getServiceUrl('registry-service', override);
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json() as Promise<T>;
}

interface ServiceRecord {
  serviceId: string;
  name: string;
  tier?: string;
  team?: string;
  url?: string;
  ownedPrefixes: string[];
  consumedPrefixes?: string[];
}

interface CleanupWarning {
  code: string;
  severity: string;
  kind: string;
  version: string;
  message?: string;
}

interface CleanupPlanItem {
  kind: string;
  currentVersion: string;
  candidateVersions: string[];
  suggestedVersion?: string;
  status: 'replaceable' | 'ambiguous' | 'blocked';
}

interface CleanupPlanResponse {
  serviceId: string;
  manifestVersion: string;
  ready: boolean;
  items: CleanupPlanItem[];
  warnings: CleanupWarning[];
}

interface OwnershipTopologyResponse {
  serviceId: string;
  topology: {
    ownedPrefixes: string[];
    consumedPrefixes: string[];
  };
  ownershipComponent: null | {
    version: string;
    state: string;
    ownedPrefixes: string[];
    consumedPrefixes: string[];
  };
  alignment: {
    status: 'aligned' | 'drifted' | 'topology-only';
    ownedPrefixes: {
      matching: string[];
      onlyInComponent: string[];
      onlyInTopology: string[];
    };
    consumedPrefixes: {
      matching: string[];
      onlyInComponent: string[];
      onlyInTopology: string[];
    };
    conflictingOwners: Array<{ prefixId: string; topologyOwnerServiceId: string }>;
    ownedPrefixConsumers: Array<{ prefixId: string; consumers: string[] }>;
    consumedPrefixOwners: Array<{ prefixId: string; ownerServiceId: string | null }>;
  };
}

function getOption(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function getPositional(args: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (value.startsWith('--')) {
      index += 1;
      continue;
    }
    result.push(value);
  }
  return result;
}

function parseReplacementArgs(
  args: string[],
): Partial<
  Record<
    'service-unit' | 'ownership' | 'exposure' | 'runtime-address' | 'deployment-binding',
    string
  >
> {
  const replacements: Partial<
    Record<
      'service-unit' | 'ownership' | 'exposure' | 'runtime-address' | 'deployment-binding',
      string
    >
  > = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--replace') continue;
    const value = args[index + 1];
    if (!value) continue;
    const [kind, version] = value.split('=', 2);
    if (!kind || !version) continue;
    if (
      kind === 'service-unit' ||
      kind === 'ownership' ||
      kind === 'exposure' ||
      kind === 'runtime-address' ||
      kind === 'deployment-binding'
    ) {
      replacements[kind] = version;
    }
    index += 1;
  }
  return replacements;
}

// ── list ──────────────────────────────────────────

export async function serviceList(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const json = args.includes('--json');

  try {
    const services: ServiceRecord[] = await fetchJson(`${registryUrl}/api/services`);

    if (json) {
      console.log(JSON.stringify(services, null, 2));
      return;
    }

    console.log(`\n══ Services (${services.length}) ══`);
    console.log(
      `  ${'ID'.padEnd(22)} ${'NAME'.padEnd(16)} ${'TIER'.padEnd(10)} ${'TEAM'.padEnd(10)} OWNED  URL`,
    );
    console.log('  ' + '─'.repeat(90));

    for (const svc of services) {
      const owned = svc.ownedPrefixes?.length ?? 0;
      const url = svc.url ?? '';
      console.log(
        `  ${svc.serviceId.padEnd(22)} ${(svc.name ?? '').padEnd(16)} ${(svc.tier ?? '—').padEnd(10)} ${(svc.team ?? '—').padEnd(10)} ${String(owned).padStart(3)}    ${url}`,
      );
    }
  } catch (err: unknown) {
    console.error(`  registry 연결 실패: ${errorMessage(err)}`);
    console.log(`  URL: ${registryUrl}/api/services`);
    console.log(`\n  registry-service가 실행 중이 아니라면 로컬 DKG로 조회할 수 있습니다:`);
    console.log(`    qa-sdk dkg service          서비스 목록 (로컬 SQLite)`);
    console.log(`    qa-sdk dkg service <id>      서비스 상세`);
  }
}

// ── show ──────────────────────────────────────────

export async function serviceShow(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const serviceId = args.find((a) => !a.startsWith('--'));

  if (!serviceId) {
    console.error('Usage: qa-sdk service show <serviceId>');
    return;
  }

  try {
    const svc: ServiceRecord = await fetchJson(`${registryUrl}/api/services/${serviceId}`);

    console.log(`\n══ Service: ${svc.serviceId} ══`);
    console.log(`  name: ${svc.name}`);
    if (svc.tier) console.log(`  tier: ${svc.tier}`);
    if (svc.team) console.log(`  team: ${svc.team}`);
    if (svc.url) console.log(`  url:  ${svc.url}`);

    if (svc.ownedPrefixes?.length) {
      console.log(`\n  ── Owned Prefixes (${svc.ownedPrefixes.length}) ──`);
      for (const p of svc.ownedPrefixes) console.log(`    ${p}`);
    }

    if (svc.consumedPrefixes?.length) {
      console.log(`\n  ── Consumed Prefixes (${svc.consumedPrefixes.length}) ──`);
      for (const p of svc.consumedPrefixes) console.log(`    ${p}`);
    }
  } catch (err: unknown) {
    console.error(`  조회 실패: ${errorMessage(err)}`);
  }
}

// ── owners ────────────────────────────────────────

export async function serviceOwners(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const json = args.includes('--json');

  try {
    const owners: Record<string, string> = await fetchJson(
      `${registryUrl}/api/services/svc-owners`,
    );

    if (json) {
      console.log(JSON.stringify(owners, null, 2));
      return;
    }

    const sorted = Object.entries(owners).toSorted(
      (a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]),
    );

    console.log(`\n══ Prefix Owners (${sorted.length}) ══`);
    let lastSvc = '';
    for (const [prefix, svc] of sorted) {
      if (svc !== lastSvc) {
        console.log(`\n  ${svc}`);
        lastSvc = svc;
      }
      console.log(`    ${prefix}`);
    }
  } catch (err: unknown) {
    console.error(`  조회 실패: ${errorMessage(err)}`);
  }
}

// ── ownership-topology ───────────────────────────

export async function serviceOwnershipTopology(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const jsonOutput = args.includes('--json');
  const serviceId = getPositional(args)[0];
  if (!serviceId) {
    console.error(
      'Usage: qa-sdk service ownership-topology <serviceId> [--version <ver>] [--json]',
    );
    return;
  }

  const version = getOption(args, '--version');
  const query = version ? `?version=${encodeURIComponent(version)}` : '';

  try {
    const data = await fetchJson<OwnershipTopologyResponse>(
      `${registryUrl}/api/services/${serviceId}/ownership/topology${query}`,
    );
    if (jsonOutput) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\n══ Ownership Topology: ${data.serviceId} ══`);
    console.log(`  status: ${data.alignment.status}`);
    if (data.ownershipComponent) {
      console.log(
        `  component: ${data.ownershipComponent.version} (${data.ownershipComponent.state})`,
      );
    } else {
      console.log('  component: -');
    }

    console.log(`\n  owned`);
    console.log(
      `    matching:          ${data.alignment.ownedPrefixes.matching.join(', ') || '-'}`,
    );
    console.log(
      `    only in component: ${data.alignment.ownedPrefixes.onlyInComponent.join(', ') || '-'}`,
    );
    console.log(
      `    only in topology:  ${data.alignment.ownedPrefixes.onlyInTopology.join(', ') || '-'}`,
    );

    console.log(`\n  consumed`);
    console.log(
      `    matching:          ${data.alignment.consumedPrefixes.matching.join(', ') || '-'}`,
    );
    console.log(
      `    only in component: ${data.alignment.consumedPrefixes.onlyInComponent.join(', ') || '-'}`,
    );
    console.log(
      `    only in topology:  ${data.alignment.consumedPrefixes.onlyInTopology.join(', ') || '-'}`,
    );

    if (data.alignment.conflictingOwners.length > 0) {
      console.log(`\n  conflicting owners`);
      for (const item of data.alignment.conflictingOwners) {
        console.log(`    ${item.prefixId}: ${item.topologyOwnerServiceId}`);
      }
    }
  } catch (err) {
    console.error(`  ownership topology 조회 실패: ${errorMessage(err)}`);
  }
}

// ── health ────────────────────────────────────────

export async function serviceHealth(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const json = args.includes('--json');
  const envIdx = args.indexOf('--env');
  const env = envIdx !== -1 && args[envIdx + 1] ? args[envIdx + 1] : (process.env.QA_ENV ?? 'dev');

  try {
    const data = await fetchJson<{
      status: string;
      up: number;
      total: number;
      down: number;
      env: string;
      checkedAt: string;
      services: Array<{
        status: string;
        serviceId: string;
        tier?: string;
        latencyMs?: number;
        error?: string;
        url: string;
      }>;
    }>(`${registryUrl}/api/health/services?env=${env}`);

    if (json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const statusIcon = (s: string) => (s === 'up' ? '●' : '○');
    const statusColor =
      data.status === 'healthy' ? 'HEALTHY' : data.status === 'degraded' ? 'DEGRADED' : 'UNHEALTHY';

    console.log(`\n══ System Health: ${statusColor} (${data.up}/${data.total} up) ══`);
    console.log(`  env: ${data.env}  checked: ${data.checkedAt}\n`);
    console.log(
      `  ${'STATUS'.padEnd(8)} ${'SERVICE'.padEnd(22)} ${'TIER'.padEnd(10)} ${'LATENCY'.padEnd(10)} URL`,
    );
    console.log('  ' + '─'.repeat(85));

    for (const svc of data.services) {
      const icon = statusIcon(svc.status);
      const lat = svc.status === 'up' ? `${svc.latencyMs}ms` : (svc.error ?? '—');
      console.log(
        `  ${icon} ${svc.status.padEnd(5)} ${svc.serviceId.padEnd(22)} ${(svc.tier ?? '—').padEnd(10)} ${lat.padEnd(10)} ${svc.url}`,
      );
    }

    if (data.down > 0) {
      console.log(`\n  ⚠ ${data.down}개 서비스 다운`);
    }
  } catch {
    // fallback: registry 없이 직접 health check
    console.log(`  registry 미응답 — 각 서비스 직접 체크\n`);
    await directHealthCheck(json);
  }
}

// ── health-all (직접 health check) ───────────────

const SERVICE_PORTS: Array<{ id: string; port: number; tier: string }> = [
  { id: 'ingest-server', port: 3200, tier: 'backend' },
  { id: 'registry-service', port: 3300, tier: 'infra' },
  { id: 'gate-service', port: 3400, tier: 'backend' },
  { id: 'query-service', port: 3500, tier: 'backend' },
  { id: 'decode-service', port: 3600, tier: 'backend' },
  { id: 'definition-service', port: 3700, tier: 'system' },
  { id: 'motion-workspace', port: 3710, tier: 'system' },
  { id: 'decision-service', port: 3800, tier: 'system' },
];

async function directHealthCheck(json: boolean): Promise<void> {
  const results: Array<{
    id: string;
    port: number;
    tier: string;
    status: string;
    latencyMs: number;
    version?: string;
    error?: string;
  }> = [];

  await Promise.all(
    SERVICE_PORTS.map(async (svc) => {
      const url = `http://localhost:${svc.port}/health`;
      const start = Date.now();
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(3_000) });
        const latency = Date.now() - start;
        if (resp.ok) {
          const data = (await resp.json()) as Record<string, unknown>;
          results.push({
            ...svc,
            status: 'up',
            latencyMs: latency,
            version: data.version as string | undefined,
          });
        } else {
          results.push({
            ...svc,
            status: 'down',
            latencyMs: latency,
            error: `HTTP ${resp.status}`,
          });
        }
      } catch (err) {
        results.push({
          ...svc,
          status: 'down',
          latencyMs: Date.now() - start,
          error: errorMessage(err),
        });
      }
    }),
  );

  // 정렬: up 먼저, 그 다음 port 순
  results.sort(
    (a, b) => (a.status === 'up' ? 0 : 1) - (b.status === 'up' ? 0 : 1) || a.port - b.port,
  );

  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const up = results.filter((r) => r.status === 'up').length;
  const total = results.length;
  const label = up === total ? 'HEALTHY' : up > 0 ? 'DEGRADED' : 'UNHEALTHY';

  console.log(`══ System Health: ${label} (${up}/${total} up) ══\n`);
  console.log(
    `  ${'STATUS'.padEnd(8)} ${'SERVICE'.padEnd(22)} ${'TIER'.padEnd(10)} ${'LATENCY'.padEnd(10)} ${'VERSION'.padEnd(10)} URL`,
  );
  console.log('  ' + '─'.repeat(90));

  for (const r of results) {
    const icon = r.status === 'up' ? '●' : '○';
    const lat = r.status === 'up' ? `${r.latencyMs}ms` : (r.error ?? '—').slice(0, 20);
    const ver = r.version ?? '—';
    console.log(
      `  ${icon} ${r.status.padEnd(5)} ${r.id.padEnd(22)} ${r.tier.padEnd(10)} ${lat.padEnd(10)} ${ver.padEnd(10)} http://localhost:${r.port}`,
    );
  }

  if (up < total) {
    console.log(`\n  ${total - up}개 서비스 미응답`);
  }
}

/** qa-sdk service health-all — registry 없이 모든 서비스 직접 health check */
export async function serviceHealthAll(args: string[]): Promise<void> {
  const json = args.includes('--json');
  await directHealthCheck(json);
}

// ── endpoints ─────────────────────────────────────

export async function serviceEndpoints(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const envFilter = (() => {
    const idx = args.indexOf('--filter-env');
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  })();

  try {
    const endpoints: Array<{
      catalogId: string;
      namespace: string;
      svcName: string;
      env: string;
      region: string;
      url: string;
    }> = await fetchJson(`${registryUrl}/api/endpoints`);

    const filtered = envFilter ? endpoints.filter((e) => e.env === envFilter) : endpoints;

    console.log(`\n══ Service Endpoints (${filtered.length}) ══`);
    console.log(`  ${'SERVICE'.padEnd(22)} ${'ENV'.padEnd(8)} ${'REGION'.padEnd(8)} URL`);
    console.log('  ' + '─'.repeat(80));

    for (const ep of filtered) {
      console.log(
        `  ${ep.svcName.padEnd(22)} ${ep.env.padEnd(8)} ${ep.region.padEnd(8)} ${ep.url}`,
      );
    }
  } catch (err: unknown) {
    console.error(`  조회 실패: ${errorMessage(err)}`);
  }
}

// ── cleanup-plan ──────────────────────────────────

export async function serviceCleanupPlan(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const jsonOutput = args.includes('--json');
  const serviceId = getPositional(args)[0];
  if (!serviceId) {
    console.error(
      'Usage: qa-sdk service cleanup-plan <serviceId> [--manifest-version <ver>] [--json]',
    );
    return;
  }

  const manifestVersion = getOption(args, '--manifest-version');
  const query = manifestVersion ? `?manifestVersion=${encodeURIComponent(manifestVersion)}` : '';

  try {
    const data = await fetchJson<CleanupPlanResponse>(
      `${registryUrl}/resolve/services/${serviceId}/cleanup-plan${query}`,
    );
    if (jsonOutput) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\n══ Cleanup Plan: ${data.serviceId} (${data.manifestVersion}) ══`);
    console.log(`  ready: ${data.ready ? 'yes' : 'no'}`);
    console.log(`  warnings: ${data.warnings.length}`);
    if (data.items.length === 0) {
      console.log('  deprecated 참조 없음');
      return;
    }
    console.log(
      `\n  ${'KIND'.padEnd(18)} ${'CURRENT'.padEnd(16)} ${'STATUS'.padEnd(12)} CANDIDATES`,
    );
    console.log('  ' + '─'.repeat(80));
    for (const item of data.items) {
      const candidates = item.candidateVersions.join(', ') || '-';
      const label = item.suggestedVersion
        ? `${item.status} -> ${item.suggestedVersion}`
        : item.status;
      console.log(
        `  ${item.kind.padEnd(18)} ${item.currentVersion.padEnd(16)} ${label.padEnd(12)} ${candidates}`,
      );
    }
  } catch (err) {
    console.error(`  cleanup plan 조회 실패: ${errorMessage(err)}`);
  }
}

// ── cleanup-draft ────────────────────────────────

export async function serviceCleanupDraft(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const jsonOutput = args.includes('--json');
  const serviceId = getPositional(args)[0];
  const newManifestVersion = getOption(args, '--new-version');

  if (!serviceId || !newManifestVersion) {
    console.error(
      'Usage: qa-sdk service cleanup-draft <serviceId> --new-version <ver> [--manifest-version <ver>] [--replace kind=version]',
    );
    return;
  }

  const sourceManifestVersion = getOption(args, '--manifest-version');
  const replacements = parseReplacementArgs(args);

  try {
    const resp = await fetch(`${registryUrl}/resolve/services/${serviceId}/cleanup-draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(sourceManifestVersion ? { sourceManifestVersion } : {}),
        newManifestVersion,
        ...(Object.keys(replacements).length > 0 ? { replacements } : {}),
      }),
    });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const data = (await resp.json()) as {
      sourceManifestVersion: string;
      manifestVersion: string;
      replacements: Record<string, string | undefined>;
    };

    if (jsonOutput) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\ncleanup draft created`);
    console.log(`  source: ${data.sourceManifestVersion}`);
    console.log(`  draft:  ${data.manifestVersion}`);
    console.log(`  replacements:`);
    for (const [kind, version] of Object.entries(data.replacements)) {
      if (version) console.log(`    ${kind}: ${version}`);
    }
  } catch (err) {
    console.error(`  cleanup draft 생성 실패: ${errorMessage(err)}`);
  }
}

// ── cleanup-activate ─────────────────────────────

export async function serviceCleanupActivate(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const jsonOutput = args.includes('--json');
  const serviceId = getPositional(args)[0];
  const manifestVersion = getOption(args, '--manifest-version');

  if (!serviceId || !manifestVersion) {
    console.error('Usage: qa-sdk service cleanup-activate <serviceId> --manifest-version <ver>');
    return;
  }

  try {
    const resp = await fetch(`${registryUrl}/resolve/services/${serviceId}/cleanup-activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ manifestVersion }),
    });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const data = (await resp.json()) as {
      previousActiveManifestVersion: string | null;
      activatedManifestVersion: string;
      state: string;
    };

    if (jsonOutput) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\ncleanup activation complete`);
    console.log(`  previous active: ${data.previousActiveManifestVersion ?? '-'}`);
    console.log(`  activated:       ${data.activatedManifestVersion}`);
    console.log(`  state:           ${data.state}`);
  } catch (err) {
    console.error(`  cleanup activation 실패: ${errorMessage(err)}`);
  }
}

// ── cleanup-execute ──────────────────────────────

export async function serviceCleanupExecute(args: string[]): Promise<void> {
  const serviceId = getPositional(args)[0];
  const newManifestVersion = getOption(args, '--new-version');
  if (!serviceId || !newManifestVersion) {
    console.error(
      'Usage: qa-sdk service cleanup-execute <serviceId> --new-version <ver> [--manifest-version <ver>] [--replace kind=version]',
    );
    return;
  }

  await serviceCleanupPlan([serviceId, ...args.filter((arg) => arg !== serviceId)]);
  await serviceCleanupDraft([serviceId, ...args.filter((arg) => arg !== serviceId)]);
  await serviceCleanupActivate([
    serviceId,
    '--manifest-version',
    newManifestVersion,
    ...args.filter(
      (arg) => arg !== serviceId && arg !== '--new-version' && arg !== newManifestVersion,
    ),
  ]);
}

// ── applications ────────────────────────────────

export async function serviceAppList(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const json = args.includes('--json');
  try {
    const apps: Array<{
      applicationId: string;
      name: string;
      description?: string;
      serviceIds: string[];
      criticality?: string;
      owner?: { team?: string };
    }> = await fetchJson(`${registryUrl}/api/applications`);
    if (json) {
      console.log(JSON.stringify(apps, null, 2));
      return;
    }
    console.log(`\n══ Applications (${apps.length}) ══\n`);
    console.log(
      `  ${'ID'.padEnd(18)} ${'이름'.padEnd(12)} ${'중요도'.padEnd(10)} ${'팀'.padEnd(12)} ${'서비스'.padStart(6)}`,
    );
    console.log('  ' + '─'.repeat(65));
    for (const app of apps) {
      console.log(
        `  ${app.applicationId.padEnd(18)} ${app.name.padEnd(12)} ${(app.criticality ?? '-').padEnd(10)} ${(app.owner?.team ?? '-').padEnd(12)} ${String(app.serviceIds.length).padStart(6)}`,
      );
    }
    console.log();
  } catch (err: unknown) {
    console.error(`  조회 실패: ${errorMessage(err)}`);
  }
}

export async function serviceAppShow(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const appId = args.find((a) => !a.startsWith('-'));
  if (!appId) {
    console.error('Usage: qa-sdk service app show <application-id>');
    return;
  }
  try {
    const app: {
      applicationId: string;
      name: string;
      description?: string;
      serviceIds: string[];
      criticality?: string;
      owner?: { team?: string };
      services: Array<{ serviceId: string; name: string; tier?: string; ownedPrefixes: string[] }>;
    } = await fetchJson(`${registryUrl}/api/applications/${appId}`);
    console.log(`\n══ Application: ${app.name} (${app.applicationId}) ══\n`);
    if (app.description) console.log(`  ${app.description}`);
    console.log(`  중요도: ${app.criticality ?? '-'}`);
    if (app.owner?.team) console.log(`  팀: ${app.owner.team}`);
    console.log(`\n  서비스 (${app.services.length}):`);
    console.log(`  ${'ID'.padEnd(22)} ${'이름'.padEnd(14)} ${'Tier'.padEnd(10)} Owned Prefixes`);
    console.log('  ' + '─'.repeat(75));
    for (const svc of app.services) {
      console.log(
        `  ${svc.serviceId.padEnd(22)} ${svc.name.padEnd(14)} ${(svc.tier ?? '-').padEnd(10)} ${svc.ownedPrefixes.join(', ') || '-'}`,
      );
    }
    console.log();
  } catch (err: unknown) {
    console.error(`  조회 실패: ${errorMessage(err)}`);
  }
}

// ── mode ───────────────────────────────────────────

export async function serviceMode(args: string[]): Promise<void> {
  const profile = loadProfile();

  const setArgs: Array<[string, string]> = [];
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--set' && args[i + 1]) {
      const [key, ...rest] = args[i + 1].split('=');
      if (key && rest.length > 0) setArgs.push([key, rest.join('=')]);
      i++;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  const modeName = positional[0] as string | undefined;
  if (modeName) {
    const preset = PROFILE_PRESETS[modeName as ServiceMode];
    if (!preset) {
      console.error(`알 수 없는 모드: ${modeName} (가능: local, staging, prod)`);
      process.exitCode = 1;
      return;
    }
    const merged: ServiceProfile = {
      ...preset,
      services: { ...preset.services },
      appHub: profile.appHub ?? preset.appHub,
    };
    applySetArgs(merged, setArgs);
    saveProfile(merged);
    printProfile(merged);
    console.log(`\n  → ${modeName} 모드로 전환 완료`);
    return;
  }

  if (setArgs.length > 0) {
    applySetArgs(profile, setArgs);
    saveProfile(profile);
    printProfile(profile);
    console.log(`\n  → 설정 업데이트 완료`);
    return;
  }

  printProfile(profile);
}

function applySetArgs(profile: ServiceProfile, setArgs: Array<[string, string]>): void {
  for (const [key, value] of setArgs) {
    if (key === 'insightsDriver') {
      if (value === 'local' || value === 'app-hub') profile.insightsDriver = value;
      else console.warn(`  경고: insightsDriver는 local 또는 app-hub만 가능`);
    } else if (key.startsWith('appHub.')) {
      if (!profile.appHub) profile.appHub = { endpoint: '', projectId: '', credential: '' };
      const field = key.slice(7);
      if (field === 'endpoint' || field === 'projectId' || field === 'credential') {
        profile.appHub[field] = value;
      } else {
        console.warn(`  경고: 알 수 없는 appHub 키 (무시: ${field})`);
      }
    } else if (
      SERVICE_IDS.includes(key as (typeof SERVICE_IDS)[number]) ||
      key in profile.services
    ) {
      profile.services[key] = value;
    } else {
      console.warn(`  경고: 알 수 없는 키 (무시: ${key})`);
    }
  }
}

function printProfile(profile: ServiceProfile): void {
  console.log(`\n══ Service Profile (${profile.mode}) ══`);
  console.log(`  insightsDriver:  ${profile.insightsDriver}`);
  console.log(`\n  서비스 URL:`);
  for (const id of SERVICE_IDS) {
    console.log(`    ${id.padEnd(22)} ${profile.services[id] ?? '(미설정)'}`);
  }
  if (profile.appHub) {
    console.log(`\n  App Hub:`);
    console.log(`    endpoint:      ${profile.appHub.endpoint || '(미설정)'}`);
    console.log(`    projectId:     ${profile.appHub.projectId || '(미설정)'}`);
    console.log(`    credential:    ${profile.appHub.credential ? '***' : '(미설정)'}`);
  }
  console.log(`\n  config: ${getProfilePath()}`);
}
