import { NoopTransport } from '@qa-sdk/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createQaBridge } from '../../qa-bridge.js';
import { createIncidentEscalationActions } from './actions/createIncidentEscalationActions.js';
import { createIncidentEscalationInitialState } from './business/incidentEscalationBusiness.js';
import { createIncidentEscalationDraft } from './business/incidentEscalationDraft.js';
import { createIncidentEscalationContext } from './contexts/IncidentEscalationContexts.js';
import { createIncidentEscalationHandlers } from './handlers/IncidentEscalationHandlers.js';

function buildHarness() {
  const bridge = createQaBridge({
    serviceName: 'viteplus-sdk-smoke',
    owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
    buildEnv: 'test',
    flushIntervalMs: 0,
    transport: new NoopTransport(),
  });
  const { sessionId, traceId } = bridge.startSession('incident_escalation_test');
  const persistIncidentEscalation = vi.fn().mockResolvedValue({
    persistedAt: '2026-03-30T01:00:00.000Z',
    submissionId: 'incident_submission_test',
  });
  const context = createIncidentEscalationContext({
    bridge,
    initialState: createIncidentEscalationInitialState(sessionId, traceId),
    persistIncidentEscalation,
  });
  const handlers = createIncidentEscalationHandlers(context);
  const actions = createIncidentEscalationActions(handlers);

  return {
    bridge,
    context,
    actions,
    persistIncidentEscalation,
  };
}

describe('incident escalation example', () => {
  it('invalid submit 시 field error와 focus 이동을 남긴다', async () => {
    const { bridge, context, actions } = buildHarness();
    const focusSpy = vi.fn();
    context.refs.incidentTitle = { focus: focusSpy };
    context.refs.serviceName = { focus: vi.fn() };
    context.refs.severity = { focus: vi.fn() };
    context.refs.customerImpact = { focus: vi.fn() };
    context.refs.mitigationPlan = { focus: vi.fn() };

    await actions.submit();

    const state = context.store.getState();
    expect(state.status).toBe('invalid');
    expect(state.validationIssues.map((issue) => issue.field)).toEqual([
      'incidentTitle',
      'serviceName',
      'severity',
    ]);
    expect(focusSpy).toHaveBeenCalledTimes(1);

    const eventKeys = bridge
      .getDebugEnvelopes()
      .flatMap((envelope) =>
        envelope.records
          .filter((record) => 'event_key' in record)
          .map((record) => record.event_key),
      );
    expect(eventKeys).toContain('incident_escalation_validation_failed');
  });

  it('valid submit 시 결과 계산과 success 상태 전이를 고정한다', async () => {
    const { bridge, context, actions, persistIncidentEscalation } = buildHarness();

    actions.updateTextField('incidentTitle', 'registry decode latency spike');
    actions.updateTextField('serviceName', 'registry-service');
    actions.updateSeverity('sev1');
    actions.updateTextField(
      'customerImpact',
      '전체 조회 요청의 40%가 timeout에 걸리고 있습니다.',
    );
    actions.updateTextField(
      'mitigationPlan',
      'slow query guard를 적용하고 read replica로 우회합니다.',
    );
    actions.updateTextField(
      'stakeholderNote',
      '15분 단위 상태 공유와 rollback fallback 준비',
    );

    await actions.submit();

    const state = context.store.getState();
    expect(state.status).toBe('success');
    expect(state.result?.recommendedRoute).toBe('eng-review');
    expect(state.result?.urgencyScore).toBeGreaterThan(0);
    expect(state.lastSubmittedAt).toBe('2026-03-30T01:00:00.000Z');
    expect(persistIncidentEscalation).toHaveBeenCalledTimes(1);

    const metricNames = bridge
      .getDebugEnvelopes()
      .flatMap((envelope) =>
        envelope.records
          .filter((record) => 'metric_name' in record)
          .map((record) => record.metric_name),
      );
    expect(metricNames).toContain('incident_escalation_score');
  });

  it('success 이후 draft 변경 시 editing으로 복귀한다', async () => {
    const { bridge, context, actions } = buildHarness();

    actions.updateTextField('incidentTitle', 'registry decode latency spike');
    actions.updateTextField('serviceName', 'registry-service');
    actions.updateSeverity('sev2');
    actions.updateTextField('customerImpact', '일부 요청 지연');
    actions.updateTextField('mitigationPlan', 'read replica 우회');
    await actions.submit();

    actions.updateTextField('serviceName', 'query-service');

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
    expect(eventKeys).toContain('incident_escalation_reopened');
  });

  it('reset 시 baseline 상태를 복원한다', async () => {
    const { bridge, context, actions } = buildHarness();

    actions.updateTextField('incidentTitle', 'registry decode latency spike');
    actions.updateTextField('serviceName', 'registry-service');
    actions.updateSeverity('sev0');
    actions.updateTextField(
      'customerImpact',
      '전체 고객이 요청 실패를 겪고 있어 긴급 대응이 필요합니다.',
    );
    actions.updateTextField(
      'mitigationPlan',
      '서비스를 maintenance로 전환하고 previous stable deploy로 롤백합니다.',
    );

    await actions.reset();

    const state = context.store.getState();
    expect(state.status).toBe('idle');
    expect(state.draft).toEqual(createIncidentEscalationDraft());
    expect(state.validationIssues).toEqual([]);
    expect(state.result).toBeNull();

    const eventKeys = bridge
      .getDebugEnvelopes()
      .flatMap((envelope) =>
        envelope.records
          .filter((record) => 'event_key' in record)
          .map((record) => record.event_key),
      );
    expect(eventKeys).toContain('incident_escalation_reset');
  });
});
