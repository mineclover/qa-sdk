import { test, expect } from "@playwright/test";
import { registerScenario, selectScenarioAndWaitForWs } from "./helpers.js";

const SCENARIO_ID = "e2e-selector";

test.beforeEach(async ({ request }) => {
  await registerScenario(request, SCENARIO_ID, [
    { id: "s1", kind: "sequence", required: true, event_key: "click" },
    { id: "s2", kind: "sequence", required: false, event_key: "input_change" },
    { id: "s3", kind: "sequence", required: true, event_key: "form_submit" },
  ]);
});

test("viz-web loads and shows scenario selector", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("QA SDK Viz");
  await expect(page.locator(".scenario-select")).toBeVisible();
});

test("registered scenario appears in dropdown", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator(`option[value="${SCENARIO_ID}"]`),
  ).toBeAttached({ timeout: 8_000 });
});

test("selecting scenario renders spec graph with correct node count", async ({
  page,
  request,
}) => {
  await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  await expect(page.locator(".spec-graph")).toBeVisible({ timeout: 8_000 });
  // 3 steps → 3 nodes
  await expect(page.locator(".graph-node")).toHaveCount(3);
});

test("selecting scenario creates session and shows ws-connected status", async ({
  page,
  request,
}) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  // session-info becomes visible
  await expect(page.locator("#session-info")).toBeVisible();

  // session ID is set to the real ID (not the loading placeholder)
  await expect(page.locator("#session-id-value")).toHaveText(sessionId);

  // WS dot is green/connected
  await expect(page.locator("#ws-status")).toHaveAttribute(
    "data-status",
    "connected",
  );
});

test("session appears in session list after creation", async ({ page }) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  const shortId = sessionId.slice(-8);
  await expect(page.locator(".session-list-items")).toContainText(
    `…${shortId}`,
    { timeout: 5_000 },
  );
});
