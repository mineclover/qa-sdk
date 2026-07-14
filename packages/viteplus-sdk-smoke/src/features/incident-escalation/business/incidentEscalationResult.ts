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
        ? '컨벤션 영향 설명이 있어 어떤 책임 경계가 깨지는지 리뷰 기록에 남길 수 있습니다.'
        : '컨벤션 영향 설명이 비어 있어 수정 우선순위를 판단하기 어렵습니다.',
      draft.stakeholderNote.trim()
        ? 'reviewer note를 handoff payload에 함께 남깁니다.'
        : 'reviewer note가 비어 있어 피드백 handoff는 core 필드만 사용합니다.',
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

function resolveIncidentEscalationRoute(draft: IncidentEscalationDraft): IncidentEscalationRoute {
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
    return `"${draft.incidentTitle}"는 blocking convention feedback으로 분류되어 office-hours 설계 논의가 필요합니다.`;
  }

  if (route === 'eng-review') {
    return `"${draft.incidentTitle}"는 eng-review에서 책임 경계 수정안을 먼저 확인해야 합니다.`;
  }

  return `"${draft.incidentTitle}"는 ship 레인에서 바로 수정 가능한 컨벤션 피드백입니다.`;
}

function resolveSeverityAction(severity: IncidentEscalationDraft['severity']): string {
  switch (severity) {
    case 'sev0':
      return 'blocking feedback은 architecture contract나 context-action boundary가 깨진 상태입니다.';
    case 'sev1':
      return 'structural feedback은 eng-review에서 책임 분리 수정안을 확인해야 합니다.';
    case 'sev2':
      return 'nit feedback은 실행 레인에서 naming/style drift를 바로 정리할 수 있습니다.';
    default:
      return '피드백 강도가 비어 있어 review route를 고정할 수 없습니다.';
  }
}
