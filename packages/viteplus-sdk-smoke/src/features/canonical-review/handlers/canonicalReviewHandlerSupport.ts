import type { CanonicalReviewActivity } from '../business/canonicalReviewActivity.js';
import type { CanonicalReviewField } from '../business/canonicalReviewValidation.js';
import type { CanonicalReviewContext } from '../contexts/CanonicalReviewContexts.js';
import {
  appendPlaybookActivity,
  flushPlaybookBridge,
  focusPlaybookField,
} from '../../shared/runtime/playbookHandlers.js';

export interface PresentedCanonicalReviewActivity {
  title: string;
  detail: string;
  tone: 'neutral' | 'critical' | 'positive' | 'accent';
  occurredAt: string;
}

export function appendCanonicalReviewActivity(
  context: CanonicalReviewContext,
  activity: CanonicalReviewActivity,
): void {
  appendPlaybookActivity(context, activity);
}

export function focusCanonicalReviewField(
  context: CanonicalReviewContext,
  field: CanonicalReviewField,
): void {
  focusPlaybookField(context, field);
}

export async function flushCanonicalReviewBridge(
  context: CanonicalReviewContext,
): Promise<void> {
  await flushPlaybookBridge(context);
}

export function presentCanonicalReviewActivity(
  activity: CanonicalReviewActivity,
): PresentedCanonicalReviewActivity {
  switch (activity.kind) {
    case 'session_ready':
      return {
        title: '세션 준비',
        detail: `qa-bridge 세션 ${activity.sessionId}로 예제를 열었습니다.`,
        tone: 'accent',
        occurredAt: activity.occurredAt,
      };
    case 'validation_failed':
      return {
        title: '검증 실패',
        detail: `${activity.issueCount}개 필드가 비어 있어 submit을 차단했습니다.`,
        tone: 'critical',
        occurredAt: activity.occurredAt,
      };
    case 'submission_started':
      return {
        title: '제출 시작',
        detail: `risk score ${activity.score}를 계산하고 logging flush를 준비했습니다.`,
        tone: 'neutral',
        occurredAt: activity.occurredAt,
      };
    case 'submission_succeeded':
      return {
        title: '제출 성공',
        detail: `${activity.route} 레인으로 결과를 고정하고 ${activity.persistedAt}에 기록했습니다.`,
        tone: 'positive',
        occurredAt: activity.occurredAt,
      };
    case 'submission_failed':
      return {
        title: '제출 실패',
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
        detail: 'baseline 초안과 validation 상태를 함께 복원했습니다.',
        tone: 'neutral',
        occurredAt: activity.occurredAt,
      };
  }
}

export function getCanonicalReviewFieldLabel(
  field: CanonicalReviewField,
): string {
  switch (field) {
    case 'changeTitle':
      return '변경 제목';
    case 'owner':
      return '담당자';
    case 'riskLevel':
      return '리스크 레벨';
    case 'rollbackPlan':
      return '롤백 계획';
  }
}
