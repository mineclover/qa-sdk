/**
 * qa-sdk ingest — 수집 서버 상호작용 CLI.
 *
 * ingest-server의 상태 확인, 테스트 이벤트 전송, 최근 데이터 조회.
 * INGEST_URL 환경변수 또는 --ingest 옵션으로 서버 주소 설정.
 */

/**
 * 환경 프로필: --env dev|prod|staging 또는 QA_ENV
 *
 * 우선순위:
 * 1. --ingest <url> (직접 지정)
 * 2. --registry <url> → /api/services/urls에서 자동 탐색
 * 3. --env dev|prod|staging → 프리셋 registry URL 사용
 * 4. QA_REGISTRY_URL / INGEST_URL 환경변수
 * 5. 기본값 (localhost dev)
 */

const ENV_PRESETS: Record<string, { registry: string; ingest: string }> = {
  dev:     { registry: "http://localhost:3300", ingest: "http://localhost:3200" },
  staging: { registry: "https://registry.staging.qa-sdk.io", ingest: "https://ingest.staging.qa-sdk.io" },
  prod:    { registry: "https://registry.qa-sdk.io", ingest: "https://ingest.qa-sdk.io" },
};

type JsonMap = Record<string, unknown>;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function asRecord(value: unknown): JsonMap {
  return value && typeof value === "object" ? value as JsonMap : {};
}

function asRecordArray(value: unknown): JsonMap[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonMap => !!item && typeof item === "object")
    : [];
}

function getEnvPreset(args: string[]): string {
  const idx = args.indexOf("--env");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env.QA_ENV ?? "dev";
}

function getRegistryUrl(args: string[]): string {
  const idx = args.indexOf("--registry");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  if (process.env.QA_REGISTRY_URL) return process.env.QA_REGISTRY_URL;
  const preset = ENV_PRESETS[getEnvPreset(args)];
  return preset?.registry ?? ENV_PRESETS.dev.registry;
}

async function getIngestUrl(args: string[]): Promise<string> {
  // 1. --ingest 직접 지정
  const ingestIdx = args.indexOf("--ingest");
  if (ingestIdx !== -1 && args[ingestIdx + 1]) return args[ingestIdx + 1];

  // 2. 환경변수 직접 지정
  if (process.env.INGEST_URL) return process.env.INGEST_URL;

  // 3. registry에서 자동 탐색
  const registryUrl = getRegistryUrl(args);
  try {
    const resp = await fetch(`${registryUrl}/api/services/urls`, { signal: AbortSignal.timeout(3_000) });
    if (resp.ok) {
      const urls = await resp.json() as Record<string, string>;
      const ingestUrl = urls["ingest-server"] ?? urls["ingest"];
      if (ingestUrl) return ingestUrl;
    }
  } catch { /* registry 연결 실패 → fallback */ }

  // 4. 환경 프리셋 기본값
  const preset = ENV_PRESETS[getEnvPreset(args)];
  return preset?.ingest ?? ENV_PRESETS.dev.ingest;
}

/** 서비스 URL 맵 전체 조회 (registry 기반) */
export async function ingestServices(args: string[]): Promise<void> {
  const registryUrl = getRegistryUrl(args);
  const envName = getEnvPreset(args);

  console.log(`\n══ Service URLs (env: ${envName}) ══`);
  console.log(`  registry: ${registryUrl}`);

  try {
    const resp = await fetch(`${registryUrl}/api/services/urls`, { signal: AbortSignal.timeout(3_000) });
    if (resp.ok) {
      const urls = await resp.json() as Record<string, string>;
      if (Object.keys(urls).length === 0) {
        console.log("  (등록된 서비스 URL 없음 — PUT /api/services로 등록)");
      } else {
        for (const [svc, url] of Object.entries(urls)) {
          console.log(`  ${svc.padEnd(22)} ${url}`);
        }
      }
    } else {
      console.log(`  ⚠ registry 응답: ${resp.status}`);
    }
  } catch (err: unknown) {
    console.error(`  ❌ registry 연결 실패: ${errorMessage(err)}`);
    console.log(`\n  프리셋 기본값 (--env ${envName}):`);
    const preset = ENV_PRESETS[envName] ?? ENV_PRESETS.dev;
    console.log(`    ingest:   ${preset.ingest}`);
    console.log(`    registry: ${preset.registry}`);
  }
}

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(5_000), ...init });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

// ── health ──────────────────────────────────────────

export async function ingestHealth(args: string[]): Promise<void> {
  const url = await getIngestUrl(args);
  const envName = getEnvPreset(args);
  console.log(`\n══ Ingest Server Health (${envName}) ══`);
  console.log(`  URL: ${url}`);

  try {
    const data = asRecord(await fetchJson(`${url}/health`));
    const db = asRecord(data.db);
    console.log(`  status: ${String(data.status ?? "ok")}`);
    if (data.uptime) console.log(`  uptime: ${String(data.uptime)}s`);
    if (data.db) console.log(`  db: ${db.connected ? "connected" : "disconnected"} (${String(db.latencyMs ?? "?")}ms)`);
    if (data.version) console.log(`  version: ${String(data.version)}`);
  } catch (err: unknown) {
    console.error(`  ❌ 연결 실패: ${errorMessage(err)}`);
    console.log(`\n  서버 주소 확인: --ingest <url> 또는 INGEST_URL 환경변수`);
  }
}

// ── send ────────────────────────────────────────────

export async function ingestSend(args: string[]): Promise<void> {
  const url = await getIngestUrl(args);
  const eventKey = args.find(a => !a.startsWith("--")) ?? "test.ping";

  // --dim key=value 파싱
  const dims: Record<string, Record<string, string>> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dim" && args[i + 1]) {
      const [key, val] = args[i + 1].split("=");
      if (key && val) {
        const [prefix, dim] = key.includes(".") ? key.split(".") : ["tracking", key];
        if (!dims[prefix]) dims[prefix] = {};
        dims[prefix][dim] = val;
      }
      i++;
    }
  }

  const traceId = `trc_cli_${Date.now().toString(36)}`;
  const sessionId = `ses_cli_${Date.now().toString(36)}`;

  const envelope = {
    transmission_id: `tx_cli_${Date.now().toString(36)}`,
    sent_at: new Date().toISOString(),
    owner: { owner_type: "agent", owner_id: "cli-test" },
    source: { service_name: "cli", sdk_name: "@qa-sdk/cli", sdk_version: "0.1.0" },
    runtime: { platform: "node" },
    build: { env: "dev" },
    records: [{
      log_id: `log_cli_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      trace_id: traceId,
      span_id: `spn_cli_${Date.now().toString(36)}`,
      record_kind: "log",
      event_key: eventKey,
      event_version: "001",
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { source: "cli", dims },
      qa_session_id: sessionId,
    }],
  };

  console.log(`\n══ Send Test Event ══`);
  console.log(`  URL: ${url}/v1/ingest`);
  console.log(`  event_key: ${eventKey}`);
  console.log(`  trace_id: ${traceId}`);
  if (Object.keys(dims).length > 0) {
    console.log(`  dims: ${JSON.stringify(dims)}`);
  }

  try {
    const data = asRecord(await fetchJson(`${url}/v1/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    }));
    console.log(`  ✅ 전송 성공`);
    if (data.transmission_id) console.log(`  transmission: ${String(data.transmission_id)}`);
    if (Array.isArray(data.trace_ids)) console.log(`  traces: ${data.trace_ids.map(String).join(", ")}`);
  } catch (err: unknown) {
    console.error(`  ❌ 전송 실패: ${errorMessage(err)}`);
  }
}

// ── recent ──────────────────────────────────────────

export async function ingestRecent(args: string[]): Promise<void> {
  const url = await getIngestUrl(args);
  const limit = parseInt(args.find(a => /^\d+$/.test(a)) ?? "10");

  console.log(`\n══ Recent Traces ══`);

  try {
    const data = asRecord(await fetchJson(`${url}/v1/sessions?limit=${limit}`));
    const traces = asRecordArray(data.items ?? data.sessions ?? data.data ?? data);

    if (traces.length === 0) {
      console.log("  (수집된 세션 없음)");
      return;
    }

    for (const t of traces.slice(0, limit)) {
      const id = String(t.sessionId ?? t.session_id ?? t.traceId ?? t.trace_id ?? "?");
      const scenario = String(t.scenarioId ?? t.scenario_id ?? "-");
      const ts = String(t.createdAt ?? t.created_at ?? t.firstTimestamp ?? "");
      console.log(`  ${id.slice(0, 25).padEnd(27)} scenario=${scenario.padEnd(20)} ${ts}`);
    }
    console.log(`  (${traces.length}건 조회)`);
  } catch (err: unknown) {
    console.error(`  ❌ 조회 실패: ${errorMessage(err)}`);
  }
}

// ── trace ───────────────────────────────────────────

export async function ingestTrace(args: string[]): Promise<void> {
  const url = await getIngestUrl(args);
  const traceId = args.find(a => !a.startsWith("--"));

  if (!traceId) {
    console.error("Usage: qa-sdk ingest trace <traceId> [--ingest url]");
    return;
  }

  console.log(`\n══ Trace: ${traceId} ══`);

  try {
    const trace = asRecord(await fetchJson(`${url}/v1/traces/${traceId}`));
    console.log(`  session: ${String(trace.sessionId ?? trace.session_id ?? "-")}`);
    console.log(`  records: ${String(trace.recordCount ?? trace.record_count ?? "?")}`);
    console.log(`  first: ${String(trace.firstTimestamp ?? "-")}`);
    console.log(`  last: ${String(trace.lastTimestamp ?? "-")}`);

    // records
    try {
      const records = asRecord(await fetchJson(`${url}/v1/traces/${traceId}/records`));
      const recs = asRecordArray(records.records ?? records.data ?? records);
      if (recs.length > 0) {
        console.log(`\n  ── Records (${recs.length}) ──`);
        for (const r of recs.slice(0, 20)) {
          const key = String(r.eventKey ?? r.event_key ?? "?");
          const ts = String(r.timestamp ?? "");
          const addr = asRecord(r.addressContext ?? r.address_context);
          const addrKeys = Object.keys(addr).length > 0 ? Object.keys(addr).join(",") : "-";
          console.log(`    ${key.padEnd(25)} ${addrKeys.padEnd(30)} ${ts}`);
        }
        if (recs.length > 20) console.log(`    ... 외 ${recs.length - 20}건`);
      }
    } catch { /* records 조회 실패 무시 */ }

    // verdicts
    try {
      const verdicts = asRecord(await fetchJson(`${url}/v1/traces/${traceId}/verdicts`));
      const vlist = asRecordArray(verdicts.verdicts ?? verdicts.data ?? verdicts);
      if (vlist.length > 0) {
        console.log(`\n  ── Verdicts (${vlist.length}) ──`);
        for (const v of vlist) {
          const scenario = String(v.scenarioId ?? v.scenario_id ?? "?");
          const verdict = String(v.overallVerdict ?? v.overall_verdict ?? "?");
          console.log(`    ${scenario.padEnd(25)} ${verdict}`);
        }
      }
    } catch { /* verdicts 조회 실패 무시 */ }
  } catch (err: unknown) {
    console.error(`  ❌ 조회 실패: ${errorMessage(err)}`);
  }
}

// ── status ──────────────────────────────────────────

export async function ingestStatus(args: string[]): Promise<void> {
  const url = await getIngestUrl(args);

  console.log(`\n══ Ingest Pipeline Status ══`);
  console.log(`  URL: ${url}`);

  // health
  try {
    const health = asRecord(await fetchJson(`${url}/health`));
    console.log(`  server: ${String(health.status ?? "ok")}`);
  } catch {
    console.error(`  server: ❌ 연결 불가`);
    return;
  }

  // scenarios
  try {
    const scenarios = asRecord(await fetchJson(`${url}/v1/scenarios`));
    const list = scenarios.scenarios ?? scenarios.data ?? scenarios;
    console.log(`  scenarios: ${Array.isArray(list) ? list.length : 0}개 등록`);
  } catch {
    console.log(`  scenarios: 조회 불가`);
  }

  // sessions
  try {
    const sessions = asRecord(await fetchJson(`${url}/v1/sessions?limit=1`));
    const list = sessions.sessions ?? sessions.data ?? sessions;
    console.log(`  sessions: ${Array.isArray(list) ? "활성" : "조회 불가"}`);
  } catch {
    console.log(`  sessions: 조회 불가`);
  }

  // DLQ
  try {
    const dlq = asRecord(await fetchJson(`${url}/v1/admin/dlq`));
    const items = dlq.items ?? dlq.data ?? dlq;
    console.log(`  dlq: ${Array.isArray(items) ? items.length : 0}건`);
  } catch {
    console.log(`  dlq: 조회 불가`);
  }
}
