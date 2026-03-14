import { test, expect } from "@playwright/test";
import {
  registerScenario,
  ingestEvents,
  selectScenarioAndWaitForWs,
  INGEST_URL,
} from "./helpers.js";

const SCENARIO_ID = "e2e-pipeline";

test.beforeEach(async ({ request }) => {
  await registerScenario(request, SCENARIO_ID, [
    { id: "s1", kind: "sequence", required: true, event_key: "click" },
    { id: "s2", kind: "sequence", required: true, event_key: "form_submit" },
  ]);
});

test("event emitted via ingest API appears in viz-web event log", async ({
  page,
  request,
}) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);
  const traceId = `trc_e2e_${Date.now()}`;

  await ingestEvents(request, {
    sessionId,
    traceId,
    eventKeys: ["click"],
  });

  // event log에 click 이벤트가 나타나야 함
  await expect(page.locator(".event-log-entry")).toHaveCount(1, {
    timeout: 10_000,
  });
  await expect(page.locator(".event-key").first()).toHaveText("click");
});

test("multiple events appear in order in the event log", async ({
  page,
  request,
}) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);
  const traceId = `trc_e2e_${Date.now()}`;

  await ingestEvents(request, {
    sessionId,
    traceId,
    eventKeys: ["click", "form_submit"],
  });

  await expect(page.locator(".event-log-entry")).toHaveCount(2, {
    timeout: 10_000,
  });

  const keys = page.locator(".event-key");
  // event-log는 순서대로 append (최신이 마지막)
  await expect(keys.nth(0)).toHaveText("click");
  await expect(keys.nth(1)).toHaveText("form_submit");
});

test("session record count increments as events arrive", async ({
  page,
  request,
}) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);
  const traceId = `trc_e2e_${Date.now()}`;

  await ingestEvents(request, {
    sessionId,
    traceId,
    eventKeys: ["click", "form_submit"],
  });

  // 세션 리스트에서 record count 배지가 2로 업데이트됨 (선택된 세션만 확인)
  await expect(page.locator(".session-item.selected .session-item-count")).toHaveText("2", {
    timeout: 10_000,
  });
});

test("recompute verdict after all required events → verdict panel shows result", async ({
  page,
  request,
}) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);
  const traceId = `trc_e2e_${Date.now()}`;

  // 시나리오 필수 이벤트 모두 주입
  await ingestEvents(request, {
    sessionId,
    traceId,
    eventKeys: ["click", "form_submit"],
  });

  // 이벤트 도착 대기
  await expect(page.locator(".event-log-entry")).toHaveCount(2, {
    timeout: 10_000,
  });

  // Refresh Verdict 버튼 클릭 → recompute + load
  await page.click("#recompute-btn");

  // 버튼이 다시 활성화될 때까지 대기 (recompute 완료)
  await expect(page.locator("#recompute-btn")).toBeEnabled({ timeout: 15_000 });

  // verdict 패널에 결과 표시됨
  await expect(page.locator(".verdict-badge-large")).toBeVisible({
    timeout: 8_000,
  });
});

test("unknown event does not appear in event log for other sessions", async ({
  page,
  request,
}) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  // 다른 세션 ID로 이벤트 주입
  const otherSessionId = `qas_other_${Date.now()}`;
  const traceId = `trc_other_${Date.now()}`;

  await ingestEvents(request, {
    sessionId: otherSessionId,
    traceId,
    eventKeys: ["click"],
  });

  // 현재 세션의 event log는 비어있어야 함 (다른 세션 이벤트는 필터됨)
  // 1초 대기 후 확인 (이벤트가 들어오지 않음을 확인)
  await page.waitForTimeout(1_500);
  await expect(page.locator(".event-log-entry")).toHaveCount(0);

  // 하지만 WS가 session:active를 발신하므로 session list에는 나타남
  await ingestEvents(request, {
    sessionId,
    traceId: `trc_own_${Date.now()}`,
    eventKeys: ["click"],
  });
  // 자신의 세션 이벤트는 log에 나타남
  await expect(page.locator(".event-log-entry")).toHaveCount(1, {
    timeout: 8_000,
  });
});
