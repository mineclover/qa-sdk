// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import type { APIRequestContext } from "@playwright/test";

export const INGEST_URL = "http://localhost:3101";

export interface StepDef {
  id: string;
  kind: "sequence" | "branch" | "optional";
  required: boolean;
  event_key: string;
}

export async function registerScenario(
  request: APIRequestContext,
  scenarioId: string,
  steps: StepDef[],
): Promise<void> {
  const res = await request.post(`${INGEST_URL}/v1/scenarios`, {
    data: {
      scenario_id: scenarioId,
      domain: "e2e",
      version: "001",
      steps,
    },
  });
  // 201 created or 409 already exists — both are fine
  if (!res.ok() && res.status() !== 409) {
    throw new Error(
      `registerScenario failed: ${res.status()} ${await res.text()}`,
    );
  }
}

export async function ingestEvents(
  request: APIRequestContext,
  opts: {
    sessionId: string;
    traceId: string;
    eventKeys: string[];
  },
): Promise<void> {
  const records = opts.eventKeys.map((eventKey, i) => ({
    log_id: `log_e2e_${opts.traceId}_${i}`,
    timestamp: new Date().toISOString(),
    record_kind: "log",
    trace_id: opts.traceId,
    span_id: `spn_e2e_${opts.traceId}_${i}`,
    event_key: eventKey,
    event_version: "001",
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: { source: "e2e" },
    qa_session_id: opts.sessionId,
  }));

  const res = await request.post(`${INGEST_URL}/v1/ingest`, {
    data: {
      transmission_id: `txm_e2e_${opts.traceId}`,
      sent_at: new Date().toISOString(),
      owner: { owner_type: "tenant", owner_id: "e2e" },
      source: {
        service_name: "e2e-test",
        sdk_name: "qa-sdk-e2e",
        sdk_version: "0.1.0",
      },
      runtime: { platform: "node" },
      build: { env: "local" },
      records,
    },
  });

  if (!res.ok()) {
    throw new Error(`ingestEvents failed: ${res.status()} ${await res.text()}`);
  }
}

/** viz-web에서 시나리오를 선택하고 WS 연결까지 대기 */
export async function selectScenarioAndWaitForWs(
  page: import("@playwright/test").Page,
  scenarioId: string,
): Promise<string> {
  await page.goto("/");
  await page
    .locator(`option[value="${scenarioId}"]`)
    .waitFor({ state: "attached", timeout: 8_000 });

  await page.selectOption(".scenario-select", scenarioId);

  await page
    .locator("#ws-status")
    .waitFor({ state: "attached" });

  await page.locator("#ws-status").waitFor({ state: "visible" });

  // WS connected
  await page
    .locator('#ws-status[data-status="connected"]')
    .waitFor({ timeout: 12_000 });

  // session ID 텍스트 추출
  const sessionId = (
    await page.locator("#session-id-value").textContent({ timeout: 8_000 })
  )?.trim();

  if (!sessionId || sessionId.startsWith("Error")) {
    throw new Error(`Session creation failed: "${sessionId}"`);
  }

  return sessionId;
}
