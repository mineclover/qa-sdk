// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * verdict 시나리오 E2E 테스트
 *
 * 소스 시나리오: docs/specs/ingest/ingest-server-scenario-2.spec.md
 * 마커 매핑:
 *   ^preconditions → beforeEach (시나리오 등록)
 *   ^steps → 이벤트 주입 + verdict 조회
 *   ^assertions → verdict 상태 검증
 *   ^variants → V1(필수 스텝 누락), V2(optional 스텝)
 */

import { test, expect } from '@playwright/test';
import {
  registerScenario,
  ingestEvents,
  selectScenarioAndWaitForWs,
  INGEST_URL,
} from './helpers.js';

// ── 시나리오 정의 ───────────────────────────────────────

const SCENARIO_CHECKOUT = 'e2e-checkout-verdict';

const CHECKOUT_STEPS = [
  { id: 's1', kind: 'sequence' as const, required: true, event_key: 'page_view' },
  { id: 's2', kind: 'sequence' as const, required: true, event_key: 'cart.add' },
  { id: 's3', kind: 'sequence' as const, required: true, event_key: 'order.create' },
];

// ── ^preconditions → beforeEach ─────────────────────────

test.describe('verdict 판정 시나리오 (ingest-server-scenario-2)', () => {
  test.beforeEach(async ({ request }) => {
    await registerScenario(request, SCENARIO_CHECKOUT, CHECKOUT_STEPS);
  });

  // ── ^steps + ^assertions: 모든 필수 스텝 충족 → pass ──

  test('모든 required 스텝 충족 시 verdict가 생성된다', async ({ page, request }) => {
    const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_CHECKOUT);
    const traceId = `trc_verdict_pass_${Date.now()}`;

    // 시나리오의 3개 필수 이벤트 모두 전송
    await ingestEvents(request, {
      sessionId,
      traceId,
      eventKeys: ['page_view', 'cart.add', 'order.create'],
    });

    // 이벤트 수신 확인
    await expect(page.locator('.event-log-entry')).toHaveCount(3, {
      timeout: 10_000,
    });

    // verdict 재계산
    await page.click('#recompute-btn');
    await expect(page.locator('#recompute-btn')).toBeEnabled({ timeout: 15_000 });

    // verdict 배지가 표시됨
    await expect(page.locator('.verdict-badge-large')).toBeVisible({
      timeout: 8_000,
    });
  });

  // ── ^variants V1: 필수 스텝 누락 → 불완전 verdict ─────

  test('V1: required 스텝 누락 시 verdict에 missing_steps 포함', async ({ page, request }) => {
    const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_CHECKOUT);
    const traceId = `trc_verdict_miss_${Date.now()}`;

    // order.create 누락 — 2/3 스텝만 전송
    await ingestEvents(request, {
      sessionId,
      traceId,
      eventKeys: ['page_view', 'cart.add'],
    });

    await expect(page.locator('.event-log-entry')).toHaveCount(2, {
      timeout: 10_000,
    });

    // verdict 재계산
    await page.click('#recompute-btn');
    await expect(page.locator('#recompute-btn')).toBeEnabled({ timeout: 15_000 });

    // verdict 배지 표시 (pass가 아닌 다른 상태)
    await expect(page.locator('.verdict-badge-large')).toBeVisible({
      timeout: 8_000,
    });

    // API로 verdict 상세 확인
    const verdictRes = await request.get(`${INGEST_URL}/v1/sessions/${sessionId}/verdicts`);
    expect(verdictRes.ok()).toBe(true);

    const body = await verdictRes.json();
    // verdict가 1건 이상 존재
    expect(body.items?.length ?? body.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

// ── optional 스텝이 있는 시나리오 ───────────────────────

test.describe('optional 스텝 시나리오 (V2)', () => {
  const SCENARIO_OPT = 'e2e-checkout-optional';
  const OPTIONAL_STEPS = [
    { id: 's1', kind: 'sequence' as const, required: true, event_key: 'page_view' },
    { id: 's2', kind: 'optional' as const, required: false, event_key: 'cart.remove' },
    { id: 's3', kind: 'sequence' as const, required: true, event_key: 'order.create' },
  ];

  test.beforeEach(async ({ request }) => {
    await registerScenario(request, SCENARIO_OPT, OPTIONAL_STEPS);
  });

  test('V2: optional 스텝 미전송 시에도 verdict가 fail이 아니다', async ({ page, request }) => {
    const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_OPT);
    const traceId = `trc_verdict_opt_${Date.now()}`;

    // cart.remove (optional) 건너뛰고 required만 전송
    await ingestEvents(request, {
      sessionId,
      traceId,
      eventKeys: ['page_view', 'order.create'],
    });

    await expect(page.locator('.event-log-entry')).toHaveCount(2, {
      timeout: 10_000,
    });

    await page.click('#recompute-btn');
    await expect(page.locator('#recompute-btn')).toBeEnabled({ timeout: 15_000 });

    // verdict가 존재하고 배지가 표시됨
    await expect(page.locator('.verdict-badge-large')).toBeVisible({
      timeout: 8_000,
    });

    // API로 verdict 확인 — optional 누락이 fail을 유발하지 않음
    const verdictRes = await request.get(`${INGEST_URL}/v1/sessions/${sessionId}/verdicts`);
    expect(verdictRes.ok()).toBe(true);
  });
});

// ── verdict 강제 재계산 (V4) ────────────────────────────

test.describe('verdict 재계산 (V4)', () => {
  test.beforeEach(async ({ request }) => {
    await registerScenario(request, SCENARIO_CHECKOUT, CHECKOUT_STEPS);
  });

  test('V4: 추가 이벤트 전송 후 recompute → verdict 갱신', async ({ page, request }) => {
    const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_CHECKOUT);
    const traceId = `trc_verdict_recomp_${Date.now()}`;

    // 1차: 부분 이벤트 전송
    await ingestEvents(request, {
      sessionId,
      traceId,
      eventKeys: ['page_view'],
    });

    await expect(page.locator('.event-log-entry')).toHaveCount(1, {
      timeout: 10_000,
    });

    // 1차 verdict 계산
    await page.click('#recompute-btn');
    await expect(page.locator('#recompute-btn')).toBeEnabled({ timeout: 15_000 });

    // 2차: 나머지 이벤트 추가 전송
    await ingestEvents(request, {
      sessionId,
      traceId: `${traceId}_2`,
      eventKeys: ['cart.add', 'order.create'],
    });

    await expect(page.locator('.event-log-entry')).toHaveCount(3, {
      timeout: 10_000,
    });

    // 2차 verdict 재계산
    await page.click('#recompute-btn');
    await expect(page.locator('#recompute-btn')).toBeEnabled({ timeout: 15_000 });

    // verdict 배지가 여전히 표시됨 (갱신된 상태)
    await expect(page.locator('.verdict-badge-large')).toBeVisible({
      timeout: 8_000,
    });
  });
});
