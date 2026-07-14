import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { validateScenarios } from './scenario-validator.js';

describe('validateScenarios', () => {
  it('accepts scenarios with traceability targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-scaffold-scenario-'));
    await writeFixture(
      root,
      'docs/scenarios/create-payment.md',
      [
        '# Scenario: Create Payment',
        '',
        '## Purpose',
        'Validate payment creation.',
        '',
        '## Traceability',
        '',
        'Use cases:',
        '- `src/modules/payment/application/use-cases/payment.use-case.ts#PaymentUseCase.create`',
        '',
        'Tests:',
        '- `tests/payment-use-case.test.ts`',
        '',
        'Contracts:',
        '- `src/modules/payment/contracts/openapi/domains/payment/spec.json`',
        '',
        '## Given',
        '## When',
        '## Then',
      ].join('\n'),
    );
    await writeFixture(root, 'src/modules/payment/application/use-cases/payment.use-case.ts', '');
    await writeFixture(root, 'tests/payment-use-case.test.ts', '');
    await writeFixture(
      root,
      'src/modules/payment/contracts/openapi/domains/payment/spec.json',
      '{}',
    );

    await expect(validateScenarios('docs/scenarios', root)).resolves.toMatchObject({
      ok: true,
      issues: [],
    });
  });

  it('flags missing required sections and missing trace targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-scaffold-scenario-'));
    await writeFixture(
      root,
      'docs/scenarios/create-payment.md',
      [
        '# Scenario: Create Payment',
        '',
        '## Purpose',
        '',
        '## Traceability',
        '',
        'Use cases:',
        '- `src/modules/payment/application/use-cases/payment.use-case.ts#PaymentUseCase.create`',
        '',
        'Tests:',
        '- `tests/payment-use-case.test.ts`',
        '',
        'Contracts:',
        '- `src/modules/payment/contracts/openapi/domains/payment/spec.json`',
      ].join('\n'),
    );

    const result = await validateScenarios('docs/scenarios', root);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      'scenario-has-required-sections',
      'scenario-has-required-sections',
      'scenario-has-required-sections',
      'scenario-trace-target-exists',
      'scenario-trace-target-exists',
      'scenario-trace-target-exists',
    ]);
  });
});

async function writeFixture(root: string, path: string, content: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${content}\n`);
}
