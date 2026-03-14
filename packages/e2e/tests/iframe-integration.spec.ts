import { test, expect } from "@playwright/test";
import { registerScenario, selectScenarioAndWaitForWs } from "./helpers.js";

const SCENARIO_ID = "e2e-iframe";

test.beforeEach(async ({ request }) => {
  await registerScenario(request, SCENARIO_ID, [
    { id: "s1", kind: "sequence", required: true, event_key: "click" },
    { id: "s2", kind: "sequence", required: false, event_key: "input_change" },
    { id: "s3", kind: "sequence", required: true, event_key: "form_submit" },
  ]);
});

test("roleplay iframe renders and shows connection status", async ({ page }) => {
  await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  // iframe이 우측 패널에 로드됨
  await expect(page.locator(".roleplay-iframe")).toBeVisible({ timeout: 8_000 });

  // iframe 내부 접근
  const iframe = page.frameLocator(".roleplay-iframe");

  // roleplay-web UI가 로드됨 (toolbar가 있어야 함)
  await expect(iframe.locator("#toolbar")).toBeVisible({ timeout: 10_000 });
});

test("roleplay iframe receives context from viz-web and shows connected status", async ({
  page,
}) => {
  await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  const iframe = page.frameLocator(".roleplay-iframe");

  // viz-web이 context를 postMessage로 전달하면 status-connected 클래스 붙음
  await expect(iframe.locator("#connection-status")).toHaveClass(
    /status-connected/,
    { timeout: 12_000 },
  );
});

test("clicking in roleplay form preview emits click event to viz-web event log", async ({
  page,
}) => {
  await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  const iframe = page.frameLocator(".roleplay-iframe");

  // iframe이 context를 받을 때까지 대기
  await expect(iframe.locator("#connection-status")).toHaveClass(
    /status-connected/,
    { timeout: 12_000 },
  );

  // form preview 영역 클릭 (이벤트 emit)
  await iframe.locator("#form-preview").click();

  // viz-web event log에 click 이벤트가 나타남 (WS 경로)
  // session_start 등 다른 이벤트도 올 수 있으므로 click key가 존재하는지 확인
  await expect(page.locator(".event-key", { hasText: "click" })).toBeVisible({
    timeout: 12_000,
  });
});

test("roleplay iframe collapse/expand toggle works", async ({ page }) => {
  await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  const container = page.locator(".roleplay-iframe-container");
  const toggleBtn = page.locator(".roleplay-header .btn-toggle");

  await expect(container).not.toHaveClass(/collapsed/);
  await expect(toggleBtn).toHaveText("Collapse");

  await toggleBtn.click();
  await expect(container).toHaveClass(/collapsed/);
  await expect(toggleBtn).toHaveText("Expand");

  await toggleBtn.click();
  await expect(container).not.toHaveClass(/collapsed/);
  await expect(toggleBtn).toHaveText("Collapse");
});
