import type { TransmissionEnvelope } from '@qa-sdk/sdk';
import type { CanonicalReviewStatus } from '../business/canonicalReviewStateMachine.js';
import type { CanonicalReviewRoute } from '../business/canonicalReviewResult.js';
import type { CanonicalReviewField } from '../business/canonicalReviewValidation.js';
import type { CanonicalReviewContext } from '../contexts/CanonicalReviewContexts.js';
import {
  presentCanonicalReviewActivity,
  type PresentedCanonicalReviewActivity,
} from '../handlers/canonicalReviewHandlerSupport.js';

export interface CanonicalReviewViewModel {
  draft: ReturnType<CanonicalReviewContext['store']['getState']>['draft'];
  statusLabel: string;
  statusTone: 'neutral' | 'critical' | 'positive' | 'accent';
  statusSummary: string;
  validationMessages: Partial<Record<CanonicalReviewField, string>>;
  result:
    | {
        routeLabel: string;
        scoreLabel: string;
        summary: string;
        rationale: string[];
      }
    | null;
  activity: PresentedCanonicalReviewActivity[];
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

export function getCanonicalReviewData(
  context: CanonicalReviewContext,
): CanonicalReviewViewModel {
  const state = context.store.getState();
  const validationMessages = Object.fromEntries(
    state.validationIssues.map((issue) => [issue.field, issue.message]),
  ) as Partial<Record<CanonicalReviewField, string>>;
  const envelopes = context.bridge.getDebugEnvelopes();
  const latestEnvelope = envelopes[envelopes.length - 1];
  const latestRecords = flattenRecords(envelopes).slice(-6).toReversed();

  return {
    draft: state.draft,
    statusLabel: resolveStatusLabel(state.status),
    statusTone: resolveStatusTone(state.status),
    statusSummary: resolveStatusSummary(state),
    validationMessages,
    result: state.result
      ? {
          routeLabel: resolveRouteLabel(state.result.recommendedRoute),
          scoreLabel: `${state.result.score}점`,
          summary: state.result.summary,
          rationale: state.result.rationale,
        }
      : null,
    activity: state.activity.map((activity) =>
      presentCanonicalReviewActivity(activity),
    ),
    sessionId: state.sessionId,
    traceId: state.traceId,
    envelopeCount: envelopes.length,
    latestRecords,
    latestEnvelope: latestEnvelope
      ? JSON.stringify(latestEnvelope, null, 2)
      : '아직 flush된 엔벨로프가 없습니다.',
    canSubmit: state.status !== 'submitting',
    submitLabel: state.status === 'submitting' ? '기록 중...' : '검토 요청 기록',
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

function resolveStatusLabel(status: CanonicalReviewStatus): string {
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
  status: CanonicalReviewStatus,
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
  state: ReturnType<CanonicalReviewContext['store']['getState']>,
): string {
  switch (state.status) {
    case 'idle':
      return 'draft, validation, logging이 아직 시작되지 않은 baseline 상태입니다.';
    case 'editing':
      return '초안을 수정 중입니다. submit 시 business validation과 route 계산이 다시 실행됩니다.';
    case 'invalid':
      return 'handler가 invalid submit을 차단하고 첫 번째 문제 필드로 포커스를 이동했습니다.';
    case 'submitting':
      return 'state machine이 submitting으로 전이됐고 qa-sdk logging flush가 함께 진행 중입니다.';
    case 'success':
      return '결과 route와 score가 고정됐고 NoopTransport 엔벨로프까지 확인 가능한 상태입니다.';
    case 'error':
      return state.submissionError ?? 'submit side effect가 실패했습니다.';
  }
}

function resolveRouteLabel(route: CanonicalReviewRoute): string {
  switch (route) {
    case 'ship':
      return 'ship';
    case 'eng-review':
      return 'eng-review';
    case 'office-hours':
      return 'office-hours';
  }
}
