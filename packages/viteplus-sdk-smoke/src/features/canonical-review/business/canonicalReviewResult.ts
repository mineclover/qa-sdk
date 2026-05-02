import type { CanonicalReviewDraft } from './canonicalReviewDraft.js';

export type CanonicalReviewRoute = 'ship' | 'eng-review' | 'office-hours';

export interface CanonicalReviewResult {
  score: number;
  recommendedRoute: CanonicalReviewRoute;
  summary: string;
  rationale: string[];
}

export function buildCanonicalReviewResult(
  draft: CanonicalReviewDraft,
): CanonicalReviewResult {
  const score = calculateCanonicalReviewScore(draft);
  const recommendedRoute = resolveCanonicalReviewRoute(draft);

  return {
    score,
    recommendedRoute,
    summary: resolveCanonicalReviewSummary(draft, recommendedRoute),
    rationale: [
      resolveRiskRationale(draft.riskLevel),
      draft.rollbackPlan.trim()
        ? '롤백 계획이 준비되어 있어 실행 리스크를 낮출 수 있습니다.'
        : '롤백 계획이 비어 있어 상위 검토 레인으로 승격됩니다.',
      draft.summary.trim()
        ? '변경 메모가 있어 handoff와 로깅 컨텍스트가 함께 남습니다.'
        : '변경 메모가 비어 있어 후속 분석 시 추가 설명이 필요합니다.',
    ],
  };
}

function calculateCanonicalReviewScore(draft: CanonicalReviewDraft): number {
  const riskBase = {
    low: 26,
    medium: 58,
    high: 86,
  } satisfies Record<Exclude<CanonicalReviewDraft['riskLevel'], ''>, number>;
  const base = draft.riskLevel ? riskBase[draft.riskLevel] : 0;
  const rollbackAdjustment = draft.rollbackPlan.trim() ? -8 : 10;
  const summaryAdjustment = draft.summary.trim() ? -4 : 0;
  return clamp(base + rollbackAdjustment + summaryAdjustment, 0, 99);
}

function resolveCanonicalReviewRoute(
  draft: CanonicalReviewDraft,
): CanonicalReviewRoute {
  if (draft.riskLevel === 'high') {
    return 'office-hours';
  }

  if (draft.riskLevel === 'medium' || !draft.rollbackPlan.trim()) {
    return 'eng-review';
  }

  return 'ship';
}

function resolveCanonicalReviewSummary(
  draft: CanonicalReviewDraft,
  route: CanonicalReviewRoute,
): string {
  if (route === 'office-hours') {
    return `"${draft.changeTitle}"는 고위험군으로 분류되어 office-hours 검토가 필요합니다.`;
  }

  if (route === 'eng-review') {
    return `"${draft.changeTitle}"는 eng-review에서 위험 완화 계획을 먼저 확인해야 합니다.`;
  }

  return `"${draft.changeTitle}"는 ship 레인으로 바로 이어갈 수 있는 수준입니다.`;
}

function resolveRiskRationale(
  riskLevel: CanonicalReviewDraft['riskLevel'],
): string {
  if (riskLevel === 'high') {
    return '리스크 레벨이 high라 strategic 레인으로 연결해야 합니다.';
  }

  if (riskLevel === 'medium') {
    return '리스크 레벨이 medium이라 tactical 레인에서 한 번 더 걸러야 합니다.';
  }

  if (riskLevel === 'low') {
    return '리스크 레벨이 low라 execution 레인까지 바로 압축할 수 있습니다.';
  }

  return '리스크 레벨이 비어 있어 아직 경로를 계산할 수 없습니다.';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
