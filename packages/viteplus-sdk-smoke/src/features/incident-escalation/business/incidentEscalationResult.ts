import type { IncidentEscalationDraft } from './incidentEscalationDraft.js';

export type IncidentEscalationRoute = 'ship' | 'eng-review' | 'office-hours';

export interface IncidentEscalationResult {
  urgencyScore: number;
  recommendedRoute: IncidentEscalationRoute;
  summary: string;
  actions: string[];
}

export function buildIncidentEscalationResult(
  draft: IncidentEscalationDraft,
): IncidentEscalationResult {
  const urgencyScore = calculateUrgencyScore(draft);
  const recommendedRoute = resolveIncidentEscalationRoute(draft);

  return {
    urgencyScore,
    recommendedRoute,
    summary: resolveIncidentEscalationSummary(draft, recommendedRoute),
    actions: [
      resolveSeverityAction(draft.severity),
      draft.customerImpact.trim()
        ? '고객 영향 설명이 있어 status update 문구를 바로 만들 수 있습니다.'
        : '고객 영향 설명이 비어 있어 comms 초안 작성이 지연됩니다.',
      draft.stakeholderNote.trim()
        ? 'stakeholder note를 handoff payload에 함께 남깁니다.'
        : 'stakeholder note가 비어 있어 escalation handoff는 core 필드만 사용합니다.',
    ],
  };
}

function calculateUrgencyScore(draft: IncidentEscalationDraft): number {
  const severityBase = {
    sev2: 32,
    sev1: 67,
    sev0: 93,
  } satisfies Record<Exclude<IncidentEscalationDraft['severity'], ''>, number>;
  const base = draft.severity ? severityBase[draft.severity] : 0;
  const mitigationAdjustment = draft.mitigationPlan.trim() ? -6 : 8;
  const customerImpactAdjustment = draft.customerImpact.includes('전체') ? 4 : 0;
  return Math.min(99, Math.max(0, base + mitigationAdjustment + customerImpactAdjustment));
}

function resolveIncidentEscalationRoute(
  draft: IncidentEscalationDraft,
): IncidentEscalationRoute {
  if (draft.severity === 'sev0') {
    return 'office-hours';
  }

  if (draft.severity === 'sev1' || !draft.mitigationPlan.trim()) {
    return 'eng-review';
  }

  return 'ship';
}

function resolveIncidentEscalationSummary(
  draft: IncidentEscalationDraft,
  route: IncidentEscalationRoute,
): string {
  if (route === 'office-hours') {
    return `"${draft.incidentTitle}"는 sev0로 분류되어 strategic escalation 레인이 필요합니다.`;
  }

  if (route === 'eng-review') {
    return `"${draft.incidentTitle}"는 eng-review에서 mitigation readiness를 먼저 확인해야 합니다.`;
  }

  return `"${draft.incidentTitle}"는 ship 레인에서 즉시 실행 가능한 수준의 incident playbook입니다.`;
}

function resolveSeverityAction(severity: IncidentEscalationDraft['severity']): string {
  switch (severity) {
    case 'sev0':
      return 'sev0는 executive context까지 함께 남겨야 합니다.';
    case 'sev1':
      return 'sev1은 tactical review를 거쳐 on-call 조율을 고정합니다.';
    case 'sev2':
      return 'sev2는 실행 레인에서 mitigation 확인 후 바로 배포 가능합니다.';
    default:
      return 'severity가 비어 있어 escalation route를 고정할 수 없습니다.';
  }
}
