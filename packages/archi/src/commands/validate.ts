import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { validateArchitecture, RULE_META } from '../engine/validator.js';

interface ValidateOptions {
  verbose?: boolean;
  rule?: string;
  category?: string;
  json?: boolean;
}

export function runValidation(targetDir: string, options: ValidateOptions) {
  const archRoot = resolve(targetDir, 'architecture');

  if (!existsSync(archRoot)) {
    console.error(
      chalk.red(`❌ 'architecture/' 폴더를 찾을 수 없습니다. 먼저 'archi init'를 실행해 주세요.`),
    );
    process.exit(1);
  }

  if (!options.json) {
    console.log(chalk.cyan(`\n╔══════════════════════════════════════════════════╗`));
    console.log(chalk.cyan(`║  Architecture Governance Validator v0.1          ║`));
    console.log(chalk.cyan(`╚══════════════════════════════════════════════════╝\n`));
    console.log(chalk.dim(`Root: ${archRoot}\n`));
  }

  // 1. 검증 가동
  const { summary, details } = validateArchitecture(archRoot);

  // 2. 필터링 및 정렬
  let rulesToReport = details;

  if (options.rule) {
    rulesToReport = rulesToReport.filter((r) => r.ruleId === options.rule);
  }

  if (options.category) {
    rulesToReport = rulesToReport.filter((r) => r.category === options.category);
  }

  // 카테고리 순으로 정렬
  rulesToReport.sort(
    (a, b) => a.category.localeCompare(b.category) || a.ruleId.localeCompare(b.ruleId),
  );

  if (options.json) {
    console.log(JSON.stringify({ summary, details: rulesToReport }, null, 2));
    process.exit(summary.fail > 0 ? 1 : 0);
  }

  // 3. 리포트 출력
  let currentCategory = '';
  for (const rule of rulesToReport) {
    if (rule.category !== currentCategory) {
      currentCategory = rule.category;
      console.log(
        chalk.bold(
          `\n── ${currentCategory} ${'─'.repeat(Math.max(0, 45 - currentCategory.length))}`,
        ),
      );
    }

    const passed = rule.results.filter((r) => r.ok).length;
    const total = rule.results.length;
    const failed = total - passed;

    const icon =
      failed === 0
        ? chalk.green('✓')
        : rule.severity === 'error'
          ? chalk.red('✗')
          : chalk.yellow('⚠');
    const ruleLabel =
      failed === 0
        ? chalk.green(rule.ruleId)
        : rule.severity === 'error'
          ? chalk.red(rule.ruleId)
          : chalk.yellow(rule.ruleId);

    console.log(
      `  ${icon} ${chalk.bold(ruleLabel)} ${rule.name} ${chalk.dim(`(${passed}/${total})`)}`,
    );

    if (options.verbose || failed > 0) {
      for (const res of rule.results) {
        if (!res.ok || options.verbose) {
          const itemIcon = res.ok
            ? chalk.green('✓')
            : rule.severity === 'error'
              ? chalk.red('✗')
              : chalk.yellow('⚠');
          const msgColor = res.ok
            ? chalk.dim
            : rule.severity === 'error'
              ? chalk.red
              : chalk.yellow;
          console.log(`    ${itemIcon} ${msgColor(res.message)}`);
        }
      }
    }
  }

  // 요약 출력
  console.log(chalk.bold(`\n── Summary ${'─'.repeat(40)}`));
  console.log(
    `  ${chalk.green('✓')} Pass: ${summary.pass}    ` +
      `${chalk.red('✗')} Fail: ${summary.fail}    ` +
      `${chalk.yellow('⚠')} Warn: ${summary.warn}    ` +
      `Total: ${summary.total}`,
  );
  console.log();

  // 에러 존재 시 실패 리턴
  if (summary.fail > 0) {
    console.log(chalk.red(`❌ 거버넌스 규칙 위반(에러)이 발견되었습니다. 수정을 요합니다.`));
    process.exit(1);
  } else {
    console.log(chalk.green(`✔ 모든 필수 아키텍처 규칙 및 정합성 검증을 통과했습니다!`));
    process.exit(0);
  }
}
