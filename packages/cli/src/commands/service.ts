/**
 * qa-sdk service — 서비스 토폴로지 조회 CLI.
 *
 * registry-service의 /api/services API에서 서비스 목록을 조회한다.
 * prefix는 비즈니스 도메인의 좌표 공간이며 특정 서비스의 배타적 소유가 아님.
 * ownedPrefixes = 주로 produce하는 prefix (Projection 배치 기준).
 */

const ENV_PRESETS: Record<string, string> = {
  dev: "http://localhost:3300",
  staging: "https://registry.staging.qa-sdk.io",
  prod: "https://registry.qa-sdk.io",
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getRegistryUrl(args: string[]): string {
  const idx = args.indexOf("--registry");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  if (process.env.QA_REGISTRY_URL) return process.env.QA_REGISTRY_URL;
  const envIdx = args.indexOf("--env");
  const env = envIdx !== -1 && args[envIdx + 1] ? args[envIdx + 1] : process.env.QA_ENV ?? "dev";
  return ENV_PRESETS[env] ?? ENV_PRESETS.dev;
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

// ── list ──────────────────────────────────────────

export async function serviceList(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const json = args.includes("--json");

  try {
    const services: ServiceRecord[] = await fetchJson(`${registryUrl}/api/services`);

    if (json) {
      console.log(JSON.stringify(services, null, 2));
      return;
    }

    console.log(`\n══ Services (${services.length}) ══`);
    console.log(`  ${"ID".padEnd(22)} ${"NAME".padEnd(16)} ${"TIER".padEnd(10)} ${"TEAM".padEnd(10)} OWNED  URL`);
    console.log("  " + "─".repeat(90));

    for (const svc of services) {
      const owned = svc.ownedPrefixes?.length ?? 0;
      const url = svc.url ?? "";
      console.log(
        `  ${svc.serviceId.padEnd(22)} ${(svc.name ?? "").padEnd(16)} ${(svc.tier ?? "—").padEnd(10)} ${(svc.team ?? "—").padEnd(10)} ${String(owned).padStart(3)}    ${url}`,
      );
    }
  } catch (err: unknown) {
    console.error(`  registry 연결 실패: ${errorMessage(err)}`);
    console.log(`  URL: ${registryUrl}/api/services`);
  }
}

// ── show ──────────────────────────────────────────

export async function serviceShow(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const serviceId = args.find(a => !a.startsWith("--"));

  if (!serviceId) {
    console.error("Usage: qa-sdk service show <serviceId>");
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
  const json = args.includes("--json");

  try {
    const owners: Record<string, string> = await fetchJson(`${registryUrl}/api/services/svc-owners`);

    if (json) {
      console.log(JSON.stringify(owners, null, 2));
      return;
    }

    const sorted = Object.entries(owners).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));

    console.log(`\n══ Prefix Owners (${sorted.length}) ══`);
    let lastSvc = "";
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

// ── health ────────────────────────────────────────

export async function serviceHealth(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const json = args.includes("--json");
  const envIdx = args.indexOf("--env");
  const env = envIdx !== -1 && args[envIdx + 1] ? args[envIdx + 1] : process.env.QA_ENV ?? "dev";

  try {
    const data = await fetchJson<{
      status: string;
      up: number;
      total: number;
      down: number;
      env: string;
      checkedAt: string;
      services: Array<{ status: string; serviceId: string; tier?: string; latencyMs?: number; error?: string; url: string }>;
    }>(`${registryUrl}/api/health/services?env=${env}`);

    if (json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const statusIcon = (s: string) => s === "up" ? "●" : "○";
    const statusColor = data.status === "healthy" ? "HEALTHY" : data.status === "degraded" ? "DEGRADED" : "UNHEALTHY";

    console.log(`\n══ System Health: ${statusColor} (${data.up}/${data.total} up) ══`);
    console.log(`  env: ${data.env}  checked: ${data.checkedAt}\n`);
    console.log(`  ${"STATUS".padEnd(8)} ${"SERVICE".padEnd(22)} ${"TIER".padEnd(10)} ${"LATENCY".padEnd(10)} URL`);
    console.log("  " + "─".repeat(85));

    for (const svc of data.services) {
      const icon = statusIcon(svc.status);
      const lat = svc.status === "up" ? `${svc.latencyMs}ms` : svc.error ?? "—";
      console.log(
        `  ${icon} ${svc.status.padEnd(5)} ${svc.serviceId.padEnd(22)} ${(svc.tier ?? "—").padEnd(10)} ${lat.padEnd(10)} ${svc.url}`,
      );
    }

    if (data.down > 0) {
      console.log(`\n  ⚠ ${data.down}개 서비스 다운`);
    }
  } catch (err: unknown) {
    // fallback: registry 자체가 죽으면 직접 호출
    console.error(`  registry 헬스체크 API 실패: ${errorMessage(err)}`);
    console.log(`  URL: ${registryUrl}/api/health/services?env=${env}`);
    console.log(`  registry-service가 실행 중인지 확인하세요.`);
  }
}

// ── endpoints ─────────────────────────────────────

export async function serviceEndpoints(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const envFilter = (() => {
    const idx = args.indexOf("--filter-env");
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  })();

  try {
    const endpoints: Array<{ catalogId: string; namespace: string; svcName: string; env: string; region: string; url: string }> =
      await fetchJson(`${registryUrl}/api/endpoints`);

    const filtered = envFilter ? endpoints.filter(e => e.env === envFilter) : endpoints;

    console.log(`\n══ Service Endpoints (${filtered.length}) ══`);
    console.log(`  ${"SERVICE".padEnd(22)} ${"ENV".padEnd(8)} ${"REGION".padEnd(8)} URL`);
    console.log("  " + "─".repeat(80));

    for (const ep of filtered) {
      console.log(`  ${ep.svcName.padEnd(22)} ${ep.env.padEnd(8)} ${ep.region.padEnd(8)} ${ep.url}`);
    }
  } catch (err: unknown) {
    console.error(`  조회 실패: ${errorMessage(err)}`);
  }
}
