export type CanonicalRiskLevel = '' | 'low' | 'medium' | 'high';

export interface CanonicalReviewDraft {
  changeTitle: string;
  owner: string;
  riskLevel: CanonicalRiskLevel;
  rollbackPlan: string;
  summary: string;
}

export function createCanonicalReviewDraft(): CanonicalReviewDraft {
  return {
    changeTitle: '',
    owner: '',
    riskLevel: '',
    rollbackPlan: '',
    summary: '',
  };
}
