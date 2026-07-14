import type { CanonicalRiskLevel } from '../business/canonicalReviewDraft.js';
import type { CanonicalReviewHandlers } from '../handlers/CanonicalReviewHandlers.js';

export interface CanonicalReviewActions {
  updateTextField(field: 'changeTitle' | 'owner' | 'rollbackPlan' | 'summary', value: string): void;
  updateRiskLevel(value: CanonicalRiskLevel): void;
  submit(): Promise<void>;
  reset(): Promise<void>;
}

export function createCanonicalReviewActions(
  handlers: CanonicalReviewHandlers,
): CanonicalReviewActions {
  return {
    updateTextField(field, value): void {
      handlers.updateTextField(field, value);
    },
    updateRiskLevel(value): void {
      handlers.updateRiskLevel(value);
    },
    submit(): Promise<void> {
      return handlers.submit();
    },
    reset(): Promise<void> {
      return handlers.reset();
    },
  };
}
