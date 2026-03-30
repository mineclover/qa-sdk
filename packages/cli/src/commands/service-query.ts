/**
 * qa-sdk gate / query — gate-service + query-service CLI 접근.
 *
 * 서비스 URL은 service-profile.json에서 중앙 관리.
 */

import { getServiceUrl } from "../lib/service-profile.js";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function resolveServiceUrl(args: string[], service: "gate" | "query"): Promise<string> {
  const flag = service === "gate" ? "--gate" : "--query";
  const idx = args.indexOf(flag);
  const override = idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  return getServiceUrl(`${service}-service`, override);
}

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(5_000), ...init });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

// ── gate check ──────────────────────────────────────

export async function gateCheck(args: string[]): Promise<void> {
  const url = await resolveServiceUrl(args, "gate");
  const prefix = args.find(a => !a.startsWith("--"));
  const version = args.find((a, i) => i > 0 && !a.startsWith("--") && args[i - 1] !== "--gate");

  if (!prefix) {
    console.error("Usage: qa-sdk gate check <prefix> [version] [--gate url]");
    return;
  }

  console.log(`\n══ Gate Check ══`);
  console.log(`  URL: ${url}`);
  console.log(`  prefix: ${prefix}, version: ${version ?? "latest"}`);

  try {
    if (version) {
      const data = await fetchJson(`${url}/gate/state/${prefix}/${version}`);
      console.log(`  state: ${JSON.stringify(data, null, 2)}`);
    } else {
      const data = await fetchJson<{ status?: string }>(`${url}/health`);
      console.log(`  health: ${data.status ?? "ok"}`);
      console.log(`\n  (version 지정 시: qa-sdk gate check ${prefix} v1)`);
    }
  } catch (err: unknown) {
    console.error(`  ❌ 조회 실패: ${errorMessage(err)}`);
  }
}

// ── gate classify ───────────────────────────────────

export async function gateClassify(args: string[]): Promise<void> {
  const url = await resolveServiceUrl(args, "gate");
  const prefix = args.find(a => !a.startsWith("--"));
  const version = args[1] && !args[1].startsWith("--") ? args[1] : "v1";
  const address = args[2] && !args[2].startsWith("--") ? parseInt(args[2]) : 0;

  if (!prefix) {
    console.error("Usage: qa-sdk gate classify <prefix> <version> <address> [--gate url]");
    return;
  }

  console.log(`\n══ Gate Classify ══`);

  try {
    const data = await fetchJson(`${url}/gate/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, version, address }),
    });
    console.log(`  result: ${JSON.stringify(data, null, 2)}`);
  } catch (err: unknown) {
    console.error(`  ❌ 분류 실패: ${errorMessage(err)}`);
  }
}

// ── query resolve ───────────────────────────────────

export async function queryResolve(args: string[]): Promise<void> {
  const url = await resolveServiceUrl(args, "query");

  // --coord key=value 파싱
  const coord: Record<string, number> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--coord" && args[i + 1]) {
      const [key, val] = args[i + 1].split("=");
      if (key && val) coord[key] = parseInt(val);
      i++;
    }
  }

  if (Object.keys(coord).length === 0) {
    console.error("Usage: qa-sdk query resolve --coord dim1=0 --coord dim2=1 [--query url]");
    return;
  }

  console.log(`\n══ Query Resolve ══`);
  console.log(`  URL: ${url}`);
  console.log(`  coord: ${JSON.stringify(coord)}`);

  try {
    const data = await fetchJson(`${url}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coord, shape: [], rules: [] }),
    });
    console.log(`  result: ${JSON.stringify(data, null, 2)}`);
  } catch (err: unknown) {
    console.error(`  ❌ 질의 실패: ${errorMessage(err)}`);
  }
}

// ── query rules ─────────────────────────────────────

export async function queryRules(args: string[]): Promise<void> {
  const url = await resolveServiceUrl(args, "query");

  console.log(`\n══ Query Rules ══`);
  console.log(`  URL: ${url}`);

  try {
    const data = await fetchJson<Record<string, unknown>>(`${url}/rules`);
    const rules = data.rules ?? data.items ?? data;
    if (Array.isArray(rules) && rules.length === 0) {
      console.log("  (등록된 규칙 없음)");
      return;
    }
    if (Array.isArray(rules)) {
      for (const r of rules.slice(0, 20)) {
        console.log(`  ${(r.id ?? "?").padEnd(20)} priority=${r.priority ?? "?"} pattern=${JSON.stringify(r.pattern ?? {}).slice(0, 50)}`);
      }
      if (rules.length > 20) console.log(`  ... 외 ${rules.length - 20}건`);
    } else {
      console.log(`  ${JSON.stringify(rules).slice(0, 200)}`);
    }
  } catch (err: unknown) {
    console.error(`  ❌ 조회 실패: ${errorMessage(err)}`);
  }
}

// ── query health ────────────────────────────────────

export async function queryHealth(args: string[]): Promise<void> {
  const url = await resolveServiceUrl(args, "query");
  console.log(`\n══ Query Service Health ══`);
  console.log(`  URL: ${url}`);
  try {
    const data = await fetchJson<{ status?: string }>(`${url}/health`);
    console.log(`  status: ${data.status ?? "ok"}`);
  } catch (err: unknown) {
    console.error(`  ❌ 연결 실패: ${errorMessage(err)}`);
  }
}

// ── gate health ─────────────────────────────────────

export async function gateHealth(args: string[]): Promise<void> {
  const url = await resolveServiceUrl(args, "gate");
  console.log(`\n══ Gate Service Health ══`);
  console.log(`  URL: ${url}`);
  try {
    const data = await fetchJson<{ status?: string }>(`${url}/health`);
    console.log(`  status: ${data.status ?? "ok"}`);
  } catch (err: unknown) {
    console.error(`  ❌ 연결 실패: ${errorMessage(err)}`);
  }
}
