/**
 * qa-sdk ingest — 수집 서버 상호작용 CLI.
 *
 * ingest-server의 상태 확인, 테스트 이벤트 전송, 최근 데이터 조회.
 * INGEST_URL 환경변수 또는 --ingest 옵션으로 서버 주소 설정.
 */

const DEFAULT_INGEST_URL = "http://localhost:3200";

function getIngestUrl(args: string[]): string {
  const idx = args.indexOf("--ingest");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env.INGEST_URL ?? process.env.QA_INGEST_URL ?? DEFAULT_INGEST_URL;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(5_000), ...init });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ── health ──────────────────────────────────────────

export async function ingestHealth(args: string[]): Promise<void> {
  const url = getIngestUrl(args);
  console.log(`\n══ Ingest Server Health ══`);
  console.log(`  URL: ${url}`);

  try {
    const data = await fetchJson(`${url}/health`);
    console.log(`  status: ${data.status ?? "ok"}`);
    if (data.uptime) console.log(`  uptime: ${data.uptime}s`);
    if (data.db) console.log(`  db: ${data.db.connected ? "connected" : "disconnected"} (${data.db.latencyMs ?? "?"}ms)`);
    if (data.version) console.log(`  version: ${data.version}`);
  } catch (err: any) {
    console.error(`  ❌ 연결 실패: ${err.message}`);
    console.log(`\n  서버 주소 확인: --ingest <url> 또는 INGEST_URL 환경변수`);
  }
}

// ── send ────────────────────────────────────────────

export async function ingestSend(args: string[]): Promise<void> {
  const url = getIngestUrl(args);
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
    const data = await fetchJson(`${url}/v1/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });
    console.log(`  ✅ 전송 성공`);
    if (data.transmission_id) console.log(`  transmission: ${data.transmission_id}`);
    if (data.trace_ids) console.log(`  traces: ${data.trace_ids.join(", ")}`);
  } catch (err: any) {
    console.error(`  ❌ 전송 실패: ${err.message}`);
  }
}

// ── recent ──────────────────────────────────────────

export async function ingestRecent(args: string[]): Promise<void> {
  const url = getIngestUrl(args);
  const limit = parseInt(args.find(a => /^\d+$/.test(a)) ?? "10");

  console.log(`\n══ Recent Traces ══`);

  try {
    const data = await fetchJson(`${url}/v1/sessions?limit=${limit}`);
    const traces = data.items ?? data.sessions ?? data.data ?? data;

    if (!Array.isArray(traces) || traces.length === 0) {
      console.log("  (수집된 세션 없음)");
      return;
    }

    for (const t of traces.slice(0, limit)) {
      const id = t.sessionId ?? t.session_id ?? t.traceId ?? t.trace_id ?? "?";
      const scenario = t.scenarioId ?? t.scenario_id ?? "-";
      const ts = t.createdAt ?? t.created_at ?? t.firstTimestamp ?? "";
      console.log(`  ${id.slice(0, 25).padEnd(27)} scenario=${scenario.padEnd(20)} ${ts}`);
    }
    console.log(`  (${traces.length}건 조회)`);
  } catch (err: any) {
    console.error(`  ❌ 조회 실패: ${err.message}`);
  }
}

// ── trace ───────────────────────────────────────────

export async function ingestTrace(args: string[]): Promise<void> {
  const url = getIngestUrl(args);
  const traceId = args.find(a => !a.startsWith("--"));

  if (!traceId) {
    console.error("Usage: qa-sdk ingest trace <traceId> [--ingest url]");
    return;
  }

  console.log(`\n══ Trace: ${traceId} ══`);

  try {
    const trace = await fetchJson(`${url}/v1/traces/${traceId}`);
    console.log(`  session: ${trace.sessionId ?? trace.session_id ?? "-"}`);
    console.log(`  records: ${trace.recordCount ?? trace.record_count ?? "?"}`);
    console.log(`  first: ${trace.firstTimestamp ?? "-"}`);
    console.log(`  last: ${trace.lastTimestamp ?? "-"}`);

    // records
    try {
      const records = await fetchJson(`${url}/v1/traces/${traceId}/records`);
      const recs = records.records ?? records.data ?? records;
      if (Array.isArray(recs) && recs.length > 0) {
        console.log(`\n  ── Records (${recs.length}) ──`);
        for (const r of recs.slice(0, 20)) {
          const key = r.eventKey ?? r.event_key ?? "?";
          const ts = r.timestamp ?? "";
          const addr = r.addressContext ?? r.address_context;
          const addrKeys = addr ? Object.keys(addr).join(",") : "-";
          console.log(`    ${key.padEnd(25)} ${addrKeys.padEnd(30)} ${ts}`);
        }
        if (recs.length > 20) console.log(`    ... 외 ${recs.length - 20}건`);
      }
    } catch { /* records 조회 실패 무시 */ }

    // verdicts
    try {
      const verdicts = await fetchJson(`${url}/v1/traces/${traceId}/verdicts`);
      const vlist = verdicts.verdicts ?? verdicts.data ?? verdicts;
      if (Array.isArray(vlist) && vlist.length > 0) {
        console.log(`\n  ── Verdicts (${vlist.length}) ──`);
        for (const v of vlist) {
          const scenario = v.scenarioId ?? v.scenario_id ?? "?";
          const verdict = v.overallVerdict ?? v.overall_verdict ?? "?";
          console.log(`    ${scenario.padEnd(25)} ${verdict}`);
        }
      }
    } catch { /* verdicts 조회 실패 무시 */ }
  } catch (err: any) {
    console.error(`  ❌ 조회 실패: ${err.message}`);
  }
}

// ── status ──────────────────────────────────────────

export async function ingestStatus(args: string[]): Promise<void> {
  const url = getIngestUrl(args);

  console.log(`\n══ Ingest Pipeline Status ══`);
  console.log(`  URL: ${url}`);

  // health
  try {
    const health = await fetchJson(`${url}/health`);
    console.log(`  server: ${health.status ?? "ok"}`);
  } catch {
    console.error(`  server: ❌ 연결 불가`);
    return;
  }

  // scenarios
  try {
    const scenarios = await fetchJson(`${url}/v1/scenarios`);
    const list = scenarios.scenarios ?? scenarios.data ?? scenarios;
    console.log(`  scenarios: ${Array.isArray(list) ? list.length : 0}개 등록`);
  } catch {
    console.log(`  scenarios: 조회 불가`);
  }

  // sessions
  try {
    const sessions = await fetchJson(`${url}/v1/sessions?limit=1`);
    const list = sessions.sessions ?? sessions.data ?? sessions;
    console.log(`  sessions: ${Array.isArray(list) ? "활성" : "조회 불가"}`);
  } catch {
    console.log(`  sessions: 조회 불가`);
  }

  // DLQ
  try {
    const dlq = await fetchJson(`${url}/v1/admin/dlq`);
    const items = dlq.items ?? dlq.data ?? dlq;
    console.log(`  dlq: ${Array.isArray(items) ? items.length : 0}건`);
  } catch {
    console.log(`  dlq: 조회 불가`);
  }
}
