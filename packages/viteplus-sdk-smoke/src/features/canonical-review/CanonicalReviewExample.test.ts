import { NoopTransport } from '@qa-sdk/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createQaBridge } from '../../qa-bridge.js';
import { createCanonicalReviewActions } from './actions/createCanonicalReviewActions.js';
import { createCanonicalReviewInitialState } from './business/canonicalReviewBusiness.js';
import { createCanonicalReviewDraft } from './business/canonicalReviewDraft.js';
import { createCanonicalReviewHandlers } from './handlers/CanonicalReviewHandlers.js';
import { createCanonicalReviewContext } from './contexts/CanonicalReviewContexts.js';

function buildHarness() {
  const bridge = createQaBridge({
    serviceName: 'viteplus-sdk-smoke',
    owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
    buildEnv: 'test',
    flushIntervalMs: 0,
    transport: new NoopTransport(),
  });
  const { sessionId, traceId } = bridge.startSession('canonical_review_test');
  const persistCanonicalReview = vi.fn().mockResolvedValue({
    persistedAt: '2026-03-30T00:00:00.000Z',
    submissionId: 'submission_test',
  });
  const context = createCanonicalReviewContext({
    bridge,
    initialState: createCanonicalReviewInitialState(sessionId, traceId),
    persistCanonicalReview,
  });
  const handlers = createCanonicalReviewHandlers(context);
  const actions = createCanonicalReviewActions(handlers);

  return {
    bridge,
    context,
    actions,
    persistCanonicalReview,
  };
}

describe('canonical review example', () => {
  it('invalid submit 시 field error와 focus 이동을 남긴다', async () => {
    const { bridge, context, actions } = buildHarness();
    const focusSpy = vi.fn();
    context.refs.changeTitle = { focus: focusSpy };
    context.refs.owner = { focus: vi.fn() };
    context.refs.riskLevel = { focus: vi.fn() };
    context.refs.rollbackPlan = { focus: vi.fn() };

    await actions.submit();

    const state = context.store.getState();
    expect(state.status).toBe('invalid');
    expect(state.validationIssues.map((issue) => issue.field)).toEqual([
      'changeTitle',
      'owner',
      'riskLevel',
    ]);
    expect(focusSpy).toHaveBeenCalledTimes(1);

    const eventKeys = bridge
      .getDebugEnvelopes()
      .flatMap((envelope) =>
        envelope.records
          .filter((record) => 'event_key' in record)
          .map((record) => record.event_key),
      );
    expect(eventKeys).toContain('canonical_review_validation_failed');
  });

  it('valid submit 시 결과 계산과 success 상태 전이를 고정한다', async () => {
    const { bridge, context, actions, persistCanonicalReview } = buildHarness();

    actions.updateTextField('changeTitle', 'registry drift fix');
    actions.updateTextField('owner', 'frontend-platform');
    actions.updateRiskLevel('medium');
    actions.updateTextField('rollbackPlan', 'config flag rollback');
    actions.updateTextField('summary', 'definition sync와 logging route를 함께 조정');

    await actions.submit();

    const state = context.store.getState();
    expect(state.status).toBe('success');
    expect(state.result?.recommendedRoute).toBe('eng-review');
    expect(state.result?.score).toBeGreaterThan(0);
    expect(state.lastSubmittedAt).toBe('2026-03-30T00:00:00.000Z');
    expect(persistCanonicalReview).toHaveBeenCalledTimes(1);

    const metricNames = bridge
      .getDebugEnvelopes()
      .flatMap((envelope) =>
        envelope.records
          .filter((record) => 'metric_name' in record)
          .map((record) => record.metric_name),
      );
    expect(metricNames).toContain('canonical_review_score');
  });

  it('success 이후 draft 변경 시 editing으로 복귀한다', async () => {
    const { bridge, context, actions } = buildHarness();

    actions.updateTextField('changeTitle', 'registry drift fix');
    actions.updateTextField('owner', 'frontend-platform');
    actions.updateRiskLevel('low');
    actions.updateTextField('rollbackPlan', 'flag off');
    await actions.submit();

    actions.updateTextField('owner', 'release-owner');

    const state = context.store.getState();
    expect(state.status).toBe('editing');
    expect(state.result).toBeNull();

    const eventKeys = bridge
      .getDebugEnvelopes()
      .flatMap((envelope) =>
        envelope.records
          .filter((record) => 'event_key' in record)
          .map((record) => record.event_key),
      );
    expect(eventKeys).toContain('canonical_review_reopened');
  });

  it('reset 시 baseline 상태를 복원한다', async () => {
    const { bridge, context, actions } = buildHarness();

    actions.updateTextField('changeTitle', 'registry drift fix');
    actions.updateTextField('owner', 'frontend-platform');
    actions.updateRiskLevel('high');
    actions.updateTextField('rollbackPlan', 'roll back through previous registry seed');

    await actions.reset();

    const state = context.store.getState();
    expect(state.status).toBe('idle');
    expect(state.draft).toEqual(createCanonicalReviewDraft());
    expect(state.validationIssues).toEqual([]);
    expect(state.result).toBeNull();

    const eventKeys = bridge
      .getDebugEnvelopes()
      .flatMap((envelope) =>
        envelope.records
          .filter((record) => 'event_key' in record)
          .map((record) => record.event_key),
      );
    expect(eventKeys).toContain('canonical_review_reset');
  });
});
