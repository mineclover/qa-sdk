import type { TransmissionEnvelope } from '@qa-sdk/sdk';
import type { IncidentEscalationRoute } from '../business/incidentEscalationResult.js';
import type { IncidentEscalationStatus } from '../business/incidentEscalationStateMachine.js';
import type { IncidentEscalationField } from '../business/incidentEscalationValidation.js';
import type { IncidentEscalationContext } from '../contexts/IncidentEscalationContexts.js';
import {
  presentIncidentEscalationActivity,
  type PresentedIncidentEscalationActivity,
} from '../handlers/incidentEscalationHandlerSupport.js';

export interface IncidentEscalationViewModel {
  draft: ReturnType<IncidentEscalationContext['store']['getState']>['draft'];
  statusLabel: string;
  statusTone: 'neutral' | 'critical' | 'positive' | 'accent';
  statusSummary: string;
  validationMessages: Partial<Record<IncidentEscalationField, string>>;
  result:
    | {
        routeLabel: string;
        urgencyLabel: string;
        summary: string;
        actions: string[];
      }
    | null;
  activity: PresentedIncidentEscalationActivity[];
  sessionId: string;
  traceId: string;
  envelopeCount: number;
  latestRecords: string[];
  latestEnvelope: string;
  canSubmit: boolean;
  submitLabel: string;
  submissionError: string | null;
  lastSubmittedAt: string | null;
}

export function getIncidentEscalationData(
  context: IncidentEscalationContext,
): IncidentEscalationViewModel {
  const state = context.store.getState();
  const validationMessages = Object.fromEntries(
    state.validationIssues.map((issue) => [issue.field, issue.message]),
  ) as Partial<Record<IncidentEscalationField, string>>;
  const envelopes = context.bridge.getDebugEnvelopes();
  const latestEnvelope = envelopes[envelopes.length - 1];
  const latestRecords = flattenRecords(envelopes).slice(-6).reverse();

  return {
    draft: state.draft,
    statusLabel: resolveStatusLabel(state.status),
    statusTone: resolveStatusTone(state.status),
    statusSummary: resolveStatusSummary(state),
    validationMessages,
    result: state.result
      ? {
          routeLabel: resolveRouteLabel(state.result.recommendedRoute),
          urgencyLabel: `${state.result.urgencyScore}점`,
          summary: state.result.summary,
          actions: state.result.actions,
        }
      : null,
    activity: state.activity.map((activity) =>
      presentIncidentEscalationActivity(activity),
    ),
    sessionId: state.sessionId,
    traceId: state.traceId,
    envelopeCount: envelopes.length,
    latestRecords,
    latestEnvelope: latestEnvelope
      ? JSON.stringify(latestEnvelope, null, 2)
      : '아직 flush된 엔벨로프가 없습니다.',
    canSubmit: state.status !== 'submitting',
    submitLabel: state.status === 'submitting' ? '에스컬레이션 기록 중...' : '에스컬레이션 기록',
    submissionError: state.submissionError,
    lastSubmittedAt: state.lastSubmittedAt,
  };
}

function flattenRecords(envelopes: readonly TransmissionEnvelope[]): string[] {
  return envelopes.flatMap((envelope) =>
    envelope.records.map((record) => {
      if ('metric_name' in record) {
        return `metric:${record.metric_name}`;
      }
      return `event:${record.event_key}`;
    }),
  );
}

function resolveStatusLabel(status: IncidentEscalationStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'editing':
      return 'Editing';
    case 'invalid':
      return 'Invalid';
    case 'submitting':
      return 'Submitting';
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
  }
}

function resolveStatusTone(
  status: IncidentEscalationStatus,
): 'neutral' | 'critical' | 'positive' | 'accent' {
  switch (status) {
    case 'idle':
      return 'neutral';
    case 'editing':
      return 'accent';
    case 'invalid':
      return 'critical';
    case 'submitting':
      return 'accent';
    case 'success':
      return 'positive';
    case 'error':
      return 'critical';
  }
}

function resolveStatusSummary(
  state: ReturnType<IncidentEscalationContext['store']['getState']>,
): string {
  switch (state.status) {
    case 'idle':
      return 'incident baseline이 아직 비어 있는 상태입니다.';
    case 'editing':
      return 'severity와 mitigation을 수정 중이며 submit 시 urgency score가 다시 계산됩니다.';
    case 'invalid':
      return 'handler가 invalid escalation submit을 차단하고 첫 문제 필드로 포커스를 이동했습니다.';
    case 'submitting':
      return 'incident route를 계산하고 qa-sdk logging flush를 같이 수행 중입니다.';
    case 'success':
      return 'incident route와 urgency score가 고정됐고 NoopTransport 엔벨로프를 확인할 수 있습니다.';
    case 'error':
      return state.submissionError ?? 'incident submit side effect가 실패했습니다.';
  }
}

function resolveRouteLabel(route: IncidentEscalationRoute): string {
  switch (route) {
    case 'ship':
      return 'ship';
    case 'eng-review':
      return 'eng-review';
    case 'office-hours':
      return 'office-hours';
  }
}
