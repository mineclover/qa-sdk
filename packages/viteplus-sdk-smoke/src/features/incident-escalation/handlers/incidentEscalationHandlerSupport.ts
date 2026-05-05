import type { IncidentEscalationActivity } from '../business/incidentEscalationActivity.js';
import type { IncidentEscalationField } from '../business/incidentEscalationValidation.js';
import type { IncidentEscalationContext } from '../contexts/IncidentEscalationContexts.js';
import {
  appendPlaybookActivity,
  flushPlaybookBridge,
  focusPlaybookField,
} from '../../shared/runtime/playbookHandlers.js';

export interface PresentedIncidentEscalationActivity {
  title: string;
  detail: string;
  tone: 'neutral' | 'critical' | 'positive' | 'accent';
  occurredAt: string;
}

export function appendIncidentEscalationActivity(
  context: IncidentEscalationContext,
  activity: IncidentEscalationActivity,
): void {
  appendPlaybookActivity(context, activity);
}

export function focusIncidentEscalationField(
  context: IncidentEscalationContext,
  field: IncidentEscalationField,
): void {
  focusPlaybookField(context, field);
}

export async function flushIncidentEscalationBridge(
  context: IncidentEscalationContext,
): Promise<void> {
  await flushPlaybookBridge(context);
}

export function presentIncidentEscalationActivity(
  activity: IncidentEscalationActivity,
): PresentedIncidentEscalationActivity {
  switch (activity.kind) {
    case 'session_ready':
      return {
        title: '세션 준비',
        detail: `qa-bridge 세션 ${activity.sessionId}로 convention feedback 예제를 열었습니다.`,
        tone: 'accent',
        occurredAt: activity.occurredAt,
      };
    case 'validation_failed':
      return {
        title: '검증 실패',
        detail: `${activity.issueCount}개 필드가 비어 있어 feedback submit을 차단했습니다.`,
        tone: 'critical',
        occurredAt: activity.occurredAt,
      };
    case 'submission_started':
      return {
        title: '피드백 분류 시작',
        detail: `convention risk score ${activity.urgencyScore}를 계산하고 logging flush를 준비했습니다.`,
        tone: 'neutral',
        occurredAt: activity.occurredAt,
      };
    case 'submission_succeeded':
      return {
        title: '피드백 기록 완료',
        detail: `${activity.route} 레인으로 경로를 고정하고 ${activity.persistedAt}에 저장했습니다.`,
        tone: 'positive',
        occurredAt: activity.occurredAt,
      };
    case 'submission_failed':
      return {
        title: '피드백 기록 실패',
        detail: activity.message,
        tone: 'critical',
        occurredAt: activity.occurredAt,
      };
    case 'draft_reopened':
      return {
        title: '초안 재개',
        detail: `${activity.field} 수정으로 success 상태를 editing으로 되돌렸습니다.`,
        tone: 'neutral',
        occurredAt: activity.occurredAt,
      };
    case 'draft_reset':
      return {
        title: '초안 초기화',
        detail: 'feedback baseline과 validation 상태를 함께 복원했습니다.',
        tone: 'neutral',
        occurredAt: activity.occurredAt,
      };
  }
}
