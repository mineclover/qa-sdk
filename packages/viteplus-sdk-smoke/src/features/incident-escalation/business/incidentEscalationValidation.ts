import type { IncidentEscalationDraft } from './incidentEscalationDraft.js';

export type IncidentEscalationField =
  | 'incidentTitle'
  | 'serviceName'
  | 'severity'
  | 'customerImpact'
  | 'mitigationPlan';

export interface IncidentEscalationValidationIssue {
  field: IncidentEscalationField;
  message: string;
}

export function validateIncidentEscalationDraft(
  draft: IncidentEscalationDraft,
): IncidentEscalationValidationIssue[] {
  const issues: IncidentEscalationValidationIssue[] = [];

  if (!draft.incidentTitle.trim()) {
    issues.push({
      field: 'incidentTitle',
      message: '피드백 제목을 입력하세요.',
    });
  }

  if (!draft.serviceName.trim()) {
    issues.push({
      field: 'serviceName',
      message: '대상 모듈/파일을 입력하세요.',
    });
  }

  if (!draft.severity) {
    issues.push({
      field: 'severity',
      message: '피드백 강도를 선택하세요.',
    });
  }

  if (
    (draft.severity === 'sev1' || draft.severity === 'sev0') &&
    draft.customerImpact.trim().length < 16
  ) {
    issues.push({
      field: 'customerImpact',
      message: '강한 컨벤션 피드백은 영향 설명을 16자 이상 남겨야 합니다.',
    });
  }

  if (
    (draft.severity === 'sev1' || draft.severity === 'sev0') &&
    draft.mitigationPlan.trim().length < 14
  ) {
    issues.push({
      field: 'mitigationPlan',
      message: '강한 컨벤션 피드백은 14자 이상의 수정 제안이 필요합니다.',
    });
  }

  return issues;
}

export function findFirstIncidentEscalationField(
  issues: readonly IncidentEscalationValidationIssue[],
): IncidentEscalationField | null {
  return issues[0]?.field ?? null;
}
