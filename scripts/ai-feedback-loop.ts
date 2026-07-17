import { execSync } from 'node:child_process';
import chalk from 'chalk';

/**
 * AI Feedback Loop —
 * 에이전트가 코드를 변경한 후 이 스크립트를 실행하여 아키텍처 정합성과 API 영향도를 즉시 확인한다.
 */

export interface FeedbackStage {
  label: string;
  command: string;
  successMessage: string;
  failureMessage: string;
}

export function getFeedbackStages(
  fullTest = process.env.QA_FEEDBACK_FULL_TEST === '1',
): readonly FeedbackStage[] {
  return [
    {
      label: fullTest ? 'workspace tests' : 'API impact regression tests',
      command: fullTest
        ? 'corepack pnpm test'
        : 'corepack pnpm exec vitest run scripts/api-impact-analyzer.test.ts scripts/ai-feedback-loop.test.ts',
      successMessage: fullTest
        ? '✨ Workspace tests passed.'
        : '✨ API impact regression tests passed.',
      failureMessage: '❌ Test stage failed.',
    },
    {
      label: 'lint',
      command: 'corepack pnpm run lint',
      successMessage: '✨ Lint passed.',
      failureMessage: '❌ Lint failed. Fix syntax errors first.',
    },
    {
      label: 'architectural boundaries',
      command: 'corepack pnpm exec tsx scripts/check-dependency-boundaries.ts',
      successMessage: '✨ Tier boundaries intact.',
      failureMessage: '❌ Architectural violations detected. Review the report.',
    },
    {
      label: 'API impact gate',
      command: 'corepack pnpm exec tsx scripts/api-impact-analyzer.ts --strict',
      successMessage: '✨ API impact gate passed.',
      failureMessage: '❌ Confirmed API impact requires review or a baseline update.',
    },
    {
      label: 'analysis accuracy',
      command: 'corepack pnpm run arch:verify',
      successMessage: '✨ Analysis accuracy checks passed.',
      failureMessage: '❌ Analysis accuracy verification failed.',
    },
    {
      label: 'API impact baseline',
      command: 'corepack pnpm run arch:impact:baseline',
      successMessage: '✨ API impact baseline passed.',
      failureMessage: '❌ API impact baseline failed.',
    },
  ];
}

async function main() {
  console.log(chalk.bold.cyan('\n🤖 AI Development Feedback Loop starting...'));
  const failures: string[] = [];
  getFeedbackStages().forEach((stage, index) => runStage(index + 1, failures, stage));

  if (failures.length > 0) {
    console.error(
      chalk.bold.red(`\n🚫 Feedback Loop failed (${failures.length}): ${failures.join(', ')}.\n`),
    );
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n🚀 Feedback Loop Complete. All 6 stages passed.\n'));
}

function runStage(stageNumber: number, failures: string[], stage: FeedbackStage): void {
  console.log(chalk.dim(`\n[${stageNumber}/6] ${stage.label}...`));
  try {
    execSync(stage.command, { stdio: 'inherit' });
    console.log(chalk.green(stage.successMessage));
  } catch {
    failures.push(stage.label);
    console.error(chalk.red(stage.failureMessage));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
