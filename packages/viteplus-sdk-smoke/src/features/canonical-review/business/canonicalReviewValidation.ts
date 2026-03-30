import type { CanonicalReviewDraft } from './canonicalReviewDraft.js';

export type CanonicalReviewField =
  | 'changeTitle'
  | 'owner'
  | 'riskLevel'
  | 'rollbackPlan';

export interface CanonicalReviewValidationIssue {
  field: CanonicalReviewField;
  message: string;
}

export function validateCanonicalReviewDraft(
  draft: CanonicalReviewDraft,
): CanonicalReviewValidationIssue[] {
  const issues: CanonicalReviewValidationIssue[] = [];

  if (!draft.changeTitle.trim()) {
    issues.push({
      field: 'changeTitle',
      message: '변경 제목을 입력하세요.',
    });
  }

  if (!draft.owner.trim()) {
    issues.push({
      field: 'owner',
      message: '담당자를 입력하세요.',
    });
  }

  if (!draft.riskLevel) {
    issues.push({
      field: 'riskLevel',
      message: '리스크 레벨을 선택하세요.',
    });
  }

  if (draft.riskLevel === 'high' && draft.rollbackPlan.trim().length < 12) {
    issues.push({
      field: 'rollbackPlan',
      message: '고위험 변경은 12자 이상의 롤백 계획이 필요합니다.',
    });
  }

  return issues;
}

export function findFirstInvalidField(
  issues: readonly CanonicalReviewValidationIssue[],
): CanonicalReviewField | null {
  return issues[0]?.field ?? null;
}
