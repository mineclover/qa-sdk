/**
 * demo-emit.ts  —  viz-web 수집 관찰용 데모 트리거
 *
 * 사용법:
 *   # viz-web에서 시나리오 선택 → 헤더에 표시된 Session ID 복사 후 실행
 *   pnpm --filter @qa-sdk/ingest-server exec tsx ../../scripts/demo-emit.ts
 *
 *   SESSION_ID=qas_abc123  pnpm --filter @qa-sdk/ingest-server exec tsx ../../scripts/demo-emit.ts
 *   SCENARIO_ID=my-scenario pnpm --filter @qa-sdk/ingest-server exec tsx ../../scripts/demo-emit.ts
 *
 * 환경변수:
 *   SESSION_ID   : viz-web 헤더에 표시된 세션 ID (지정 시 해당 세션에 이벤트 주입)
 *   SCENARIO_ID  : 세션 없을 때 자동 생성할 시나리오 ID
 *   INGEST_URL   : 기본값 http://localhost:3200
 *   DELAY_MS     : 이벤트 간 딜레이 ms (기본값 800)
 */

const INGEST_URL = process.env["INGEST_URL"] ?? "http://localhost:3200";
const DELAY_MS = Number(process.env["DELAY_MS"] ?? "800");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${INGEST_URL}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function main() {
  // ── 1. Resolve session + scenario ──────────────────────────
  let sessionId = process.env["SESSION_ID"];
  let scenarioId = process.env["SCENARIO_ID"];

  if (!sessionId && !scenarioId) {
    const { items } = await api<{ items: Array<{ scenario_id: string }> }>("/v1/scenarios");
    if (items.length === 0) {
      console.error("등록된 시나리오가 없습니다. POST /v1/scenarios 로 먼저 등록하세요.");
      process.exit(1);
    }
    scenarioId = items[0]!.scenario_id;
    console.log(`자동 선택된 시나리오: ${scenarioId}`);
  }

  if (!sessionId) {
    const session = await api<{ sessionId: string }>("/v1/sessions", { scenarioId });
    sessionId = session.sessionId;
    console.log(`새 세션 생성: ${sessionId}  (scenario: ${scenarioId})`);
  } else {
    const session = await api<{ sessionId: string; scenarioId: string | null }>(
      `/v1/sessions/${sessionId}`,
    ).catch(() => null);
    if (!session) { console.error(`세션 없음: ${sessionId}`); process.exit(1); }
    scenarioId = session.scenarioId ?? scenarioId ?? "unknown";
    console.log(`기존 세션 사용: ${sessionId}  (scenario: ${scenarioId})`);
  }

  // ── 2. Fetch scenario steps ─────────────────────────────────
  let steps: string[] = [];
  try {
    const spec = await api<{ steps: Array<{ event_key: string }> }>(`/v1/scenarios/${scenarioId}`);
    steps = spec.steps.map((s) => s.event_key);
    console.log(`\n시나리오 스텝 (${steps.length}): ${steps.join(" → ")}\n`);
  } catch {
    steps = ["user:page_view", "user:click", "api:request", "api:response"];
    console.log(`스펙 없음, 제네릭 이벤트 사용: ${steps.join(" → ")}\n`);
  }

  // ── 3. Emit records one by one with delay ───────────────────
  const traceId = `trc_demo_${Date.now()}`;
  const spanId = `spn_root_${Date.now()}`;

  for (let i = 0; i < steps.length; i++) {
    const eventKey = steps[i]!;
    const record = {
      log_id: `log_${Date.now()}_${i}`,
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: undefined,
      timestamp: new Date().toISOString(),
      record_kind: "log",
      event_key: eventKey,
      event_version: "001",
      qa_session_id: sessionId,
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { step_index: i, demo: true },
    };

    const envelope = {
      transmission_id: `txm_${Date.now()}_${i}`,
      sent_at: new Date().toISOString(),
      owner: { owner_type: "workspace", owner_id: "demo" },
      source: { service_name: "demo-trigger", sdk_name: "qa-sdk-js", sdk_version: "0.1.0" },
      runtime: { platform: "node" },
      build: { env: "local" },
      records: [record],
    };

    process.stdout.write(`  → [${i + 1}/${steps.length}] ${eventKey} ... `);
    await api("/v1/ingest", envelope);
    console.log("✓");

    if (i < steps.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n완료. Trace: ${traceId}`);
  console.log(`Verdict: GET ${INGEST_URL}/v1/traces/${traceId}/verdicts`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
