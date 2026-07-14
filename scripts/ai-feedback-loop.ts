import { execSync } from 'node:child_process';
import chalk from 'chalk';

/**
 * AI Feedback Loop —
 * 에이전트가 코드를 변경한 후 이 스크립트를 실행하여 아키텍처 정합성과 API 영향도를 즉시 확인한다.
 */

async function main() {
  console.log(chalk.bold.cyan('\n🤖 AI Development Feedback Loop starting...'));
  let failures = 0;

  // 1. Lint Check
  console.log(chalk.dim('\n[1/4] Checking syntax & lint...'));
  try {
    execSync('corepack pnpm run lint', { stdio: 'inherit' });
    console.log(chalk.green('✨ Lint passed.'));
  } catch {
    failures++;
    console.error(chalk.red('❌ Lint failed. Fix syntax errors first.'));
  }

  // 2. Architectural Boundaries
  console.log(chalk.dim('\n[2/4] Verifying architectural tiers...'));
  try {
    execSync('tsx scripts/check-dependency-boundaries.ts', { stdio: 'inherit' });
    console.log(chalk.green('✨ Tier boundaries intact.'));
  } catch {
    failures++;
    console.error(chalk.red('❌ Architectural violations detected. Review the report.'));
  }

  // 3. API Impact Analysis
  console.log(chalk.dim('\n[3/4] Analyzing API Impact Radius...'));
  try {
    execSync('tsx scripts/api-impact-analyzer.ts', { stdio: 'inherit' });
  } catch {
    failures++;
    console.error(chalk.red('❌ Impact analysis failed.'));
  }

  // 4. Analysis OS Accuracy
  console.log(chalk.dim('\n[4/4] Verifying analysis system accuracy...'));
  try {
    execSync('corepack pnpm run arch:verify', { stdio: 'inherit' });
    console.log(chalk.green('✨ Analysis accuracy checks passed.'));
  } catch {
    failures++;
    console.error(chalk.red('❌ Analysis accuracy verification failed.'));
  }

  if (failures > 0) {
    console.error(chalk.bold.red(`\n🚫 Feedback Loop failed with ${failures} failing stage(s).\n`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n🚀 Feedback Loop Complete. Proceed with caution.\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
