import { describe, expect, it } from 'vitest';
import { getFeedbackStages } from './ai-feedback-loop.js';

describe('ai feedback loop stages', () => {
  it('keeps the default six-stage order and strict API gate', () => {
    const stages = getFeedbackStages(false);

    expect(stages.map((stage) => stage.label)).toEqual([
      'API impact regression tests',
      'lint',
      'architectural boundaries',
      'API impact gate',
      'analysis accuracy',
      'API impact baseline',
    ]);
    expect(stages[0]?.command).toContain('scripts/ai-feedback-loop.test.ts');
    expect(stages[3]?.command).toContain('api-impact-analyzer.ts --strict');
  });

  it('exposes the full workspace test mode explicitly', () => {
    expect(getFeedbackStages(true)[0]).toMatchObject({
      label: 'workspace tests',
      command: 'corepack pnpm test',
    });
  });
});
